// Seeded chat data for the chat e2e flows, created through the local `keybase` CLI against the
// running service (signed in as KB_SMOKE_USER, who owns KB_E2E_TEAM). Every step checks what is
// already there first, so running it again only fills in what is missing. Node-only: shared by
// the Electron flows and, later, the iOS ones (both drive a host that has the CLI).
//
// Accounts and the team come from the environment or ~/.config/keybase-e2e/env, never from this file:
//   KB_SMOKE_USER  the account the app under test is signed in as, and the team owner
//   KB_SECOND_USER a second account, a writer in the team (sends "incoming" messages)
//   KB_E2E_TEAM    the team the e2e channels live in
import {spawn, execFile, type ChildProcessWithoutNullStreams} from 'child_process'
import {randomBytes} from 'crypto'
import * as path from 'path'
import * as readline from 'readline'
import {loadE2EAccounts, type E2EAccounts} from '../accounts/env.ts'
import {parseStampedName, runIdFromEnv, stampedChannelName, stampedTeamName} from '../accounts/run-id.ts'
import {keybaseBin} from './keybase-bin.ts'

// The same accounts, and the same precedence (environment over the env file), as loadE2EEnv.
export const e2eAccounts = (): E2EAccounts => loadE2EAccounts()

export const E2E_CHANNELS = {
  long: 'e2e-long',
  media: 'e2e-media',
  // min writer role admin: the second account (a writer) can read it but not post
  readonly: 'e2e-readonly',
  scratch: 'e2e-scratch',
  // a short history that the first load brings in whole, so the thread's intro card lands in its
  // header after the rows do; nothing ever posts to it after seeding
  short: 'e2e-short',
  // older rows under a newest page that is mostly deleted messages (see seedSparse)
  sparse: 'e2e-sparse',
} as const
export type E2EChannel = (typeof E2E_CHANNELS)[keyof typeof E2E_CHANNELS]

// e2e-long: LONG_COUNT messages, oldest first, each carrying its own marker.
export const LONG_COUNT = 400
export const longMarker = (index: number) => `e2e-long-${String(index).padStart(4, '0')}`

// Words that appear in exactly one e2e-long message each, at a known index (1 is the oldest,
// LONG_COUNT the newest). "deep" sits far enough back that the thread has to load older pages to
// reach it. Letters only: the search index splits on punctuation.
export const LONG_SEARCH_TOKENS = {
  deep: {index: 12, token: 'quokkadeepmarker'},
  middle: {index: 200, token: 'quokkamiddlemarker'},
  shallow: {index: 392, token: 'quokkashallowmarker'},
} as const

const tokenAt = new Map<number, string>(Object.values(LONG_SEARCH_TOKENS).map(t => [t.index, t.token]))

// Every tenth message runs to three lines, so rows are not all one height.
export const longBody = (index: number) => {
  const token = tokenAt.get(index)
  const first = token ? `${longMarker(index)} ${token}` : longMarker(index)
  return index % 10 === 0 ? `${first}\nsecond line of ${index}\nthird line of ${index}` : first
}

// e2e-short: every message of it fits in the first page the desktop thread loads (100), and it
// still runs past one viewport, so the thread scrolls.
export const SHORT_COUNT = 40
export const shortMarker = (index: number) => `e2e-short-${String(index).padStart(4, '0')}`
const shortBody = (index: number) =>
  index % 5 === 0 ? `${shortMarker(index)}\nsecond line of ${index}\nthird line of ${index}` : shortMarker(index)

// e2e-sparse: SPARSE_OLDER messages, then SPARSE_DELETED deleted ones, then SPARSE_NEWER more. A
// page of the newest messages is mostly the deleted ones, which draw nothing, so the rows a phone's
// first page draws do not fill its view: the thread has to load older pages with nobody scrolling.
export const SPARSE_OLDER = 30
export const SPARSE_DELETED = 18
export const SPARSE_NEWER = 2
export const sparseMarker = (index: number) => `e2e-sparse-${String(index).padStart(4, '0')}`

// e2e-scratch keeps at least this many text messages, so the scroll flows that post to it have
// history above the viewport to scroll into from the first run on.
export const SCRATCH_MIN_TEXTS = 60
const scratchPadMarker = (index: number) => `e2e-scratch-pad-${String(index).padStart(4, '0')}`

export const READONLY_COUNT = 3
export const readonlyMarker = (index: number) => `e2e-readonly-${String(index).padStart(4, '0')}`

// e2e runners start in shared/
const fixturesDir = path.resolve('tests/e2e/fixtures')
export const MEDIA_FIXTURES = [
  // 480x640: its preview is 320px tall, so the middle of the video sits above the desktop video's
  // own control bar (the bottom ~72px), where a press never reaches the page
  {file: path.join(fixturesDir, 'e2e-video.mp4'), title: 'e2e-media-video-tall'},
  {file: path.join(fixturesDir, 'e2e-image.png'), title: 'e2e-media-image'},
  {file: path.join(fixturesDir, 'e2e-file.txt'), title: 'e2e-media-file'},
] as const

const log = (line: string) => {
  console.log(`[chat-data] ${line}`)
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// -- chat api -------------------------------------------------------------------------------------

type ApiError = {code?: number; message: string}
type ApiResponse<R> = {error?: ApiError; result?: R}

type ChannelRef = {members_type: 'team'; name: string; topic_name: string}

type ApiMessage = {
  msg: {
    id: number
    content: {
      type: string
      text?: {body: string}
      attachment?: {object?: {filename?: string; title?: string}}
    }
    sender: {username: string}
  }
}
export type CliMessage = ApiMessage['msg']

type ReadResult = {
  messages?: Array<ApiMessage>
  pagination?: {next?: string; last?: boolean}
}

type ConvSummary = {id: string; channel: {topic_name?: string}}

class RateLimited extends Error {}

// How long one keybase CLI call or chat api request may take before it counts as stuck.
const cliTimeoutMs = 60_000

const isRateLimit = (e: ApiError) => e.code === 2501 || /rate limit/i.test(e.message)

// One long-lived `keybase chat api` process: it reads a stream of requests on stdin and answers
// each with one line on stdout, so seeding does not pay a process start per message.
class ChatApi {
  private proc: ChildProcessWithoutNullStreams
  private lines: AsyncIterator<string>

  constructor() {
    this.proc = spawn(keybaseBin(), ['chat', 'api'])
    this.lines = readline.createInterface({input: this.proc.stdout})[Symbol.asyncIterator]()
  }

  private async callOnce<R>(method: string, options: object): Promise<R> {
    this.proc.stdin.write(`${JSON.stringify({method, params: {options}})}\n`)
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        // its answer can no longer be matched to its call, so the process goes with it
        this.proc.kill()
        reject(new Error(`keybase chat api ${method}: no answer in ${cliTimeoutMs / 1000}s`))
      }, cliTimeoutMs)
    })
    const next = await Promise.race([this.lines.next(), timeout]).finally(() => clearTimeout(timer))
    if (next.done) {
      throw new Error(`keybase chat api exited during ${method}`)
    }
    const res = JSON.parse(next.value) as ApiResponse<R>
    if (res.error) {
      if (isRateLimit(res.error)) throw new RateLimited(res.error.message)
      throw new Error(`chat api ${method}: ${res.error.message}`)
    }
    return res.result as R
  }

  // Retries rate-limit errors (the service allows about 9000 chat calls per 15 minutes), waiting
  // longer each time, for up to the length of one window.
  async call<R>(method: string, options: object): Promise<R> {
    let waitMs = 30_000
    let waited = 0
    for (;;) {
      try {
        return await this.callOnce<R>(method, options)
      } catch (e) {
        if (!(e instanceof RateLimited) || waited > 16 * 60_000) throw e
        log(`rate limited on ${method}; waiting ${waitMs / 1000}s`)
        await sleep(waitMs)
        waited += waitMs
        waitMs = Math.min(waitMs * 2, 4 * 60_000)
      }
    }
  }

  close() {
    this.proc.stdin.end()
  }
}

const cli = async (args: Array<string>) =>
  new Promise<string>((resolve, reject) => {
    execFile(keybaseBin(), args, {encoding: 'utf8', killSignal: 'SIGKILL', timeout: cliTimeoutMs}, (err, stdout, stderr) => {
      if (err?.killed) reject(new Error(`keybase ${args.join(' ')}: no answer in ${cliTimeoutMs / 1000}s`))
      else if (err) reject(new Error(`keybase ${args.join(' ')}: ${stderr || err.message}`))
      else resolve(`${stdout}${stderr}`)
    })
  })

// Setting a min writer role or deleting a channel asks for confirmation on /dev/tty, so the command
// runs under `expect` (a pseudo-terminal; `script` needs a terminal on its own stdin, which a test
// runner does not have), which types `answer` and Enter once `prompt` appears. Exit code 2 means
// the prompt never came.
const confirmScript = [
  'set timeout 30',
  'spawn {*}$env(KB_CONFIRM_CMD)',
  'expect $env(KB_CONFIRM_PROMPT) { send "$env(KB_CONFIRM_ANSWER)\\r" } timeout { exit 2 }',
  'expect eof',
  'lassign [wait] pid spawnid oserr code',
  'exit $code',
].join('; ')

const cliConfirmed = async (args: Array<string>, prompt = 'Hit Enter to confirm', answer = '') =>
  new Promise<void>((resolve, reject) => {
    const env = {
      ...process.env,
      KB_CONFIRM_ANSWER: answer,
      KB_CONFIRM_CMD: [keybaseBin(), ...args].map(a => `{${a}}`).join(' '),
      KB_CONFIRM_PROMPT: prompt,
    }
    const proc = spawn('expect', ['-c', confirmScript], {env})
    let output = ''
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`keybase ${args.join(' ')} timed out: ${output}`))
    }, 60_000)
    proc.stdout.on('data', (d: Buffer) => (output += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (output += d.toString()))
    proc.on('exit', code => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`keybase ${args.join(' ')} exited ${code}: ${output}`))
    })
  })

const channelRef = (team: string, topicName: string): ChannelRef => ({
  members_type: 'team',
  name: team,
  topic_name: topicName,
})

// Every message in the channel, oldest first. Peeks, so reading does not mark the channel read.
const readAll = async (api: ChatApi, channel: ChannelRef) => {
  const out: Array<ApiMessage['msg']> = []
  let next: string | undefined
  for (;;) {
    const res = await api.call<ReadResult>('read', {
      channel,
      pagination: next ? {next, num: 500} : {num: 500},
      peek: true,
    })
    out.push(...(res.messages ?? []).map(m => m.msg))
    if (!res.pagination?.next || res.pagination.last || !res.messages?.length) break
    next = res.pagination.next
  }
  return out.reverse()
}

const textBodies = (msgs: ReadonlyArray<ApiMessage['msg']>) =>
  msgs.filter(m => m.content.type === 'text').map(m => m.content.text?.body ?? '')

const listChannels = async (api: ChatApi, team: string) => {
  const res = await api.call<{conversations?: Array<ConvSummary>}>('listconvsonname', {
    members_type: 'team',
    name: team,
    topic_type: 'CHAT',
  })
  return new Map((res.conversations ?? []).map(c => [c.channel.topic_name ?? '', c.id]))
}

const ensureChannel = async (api: ChatApi, team: string, topicName: string) => {
  let id = (await listChannels(api, team)).get(topicName)
  if (!id) {
    log(`creating #${topicName}`)
    await cli(['chat', 'create-channel', team, topicName])
    id = (await listChannels(api, team)).get(topicName)
  }
  if (!id) throw new Error(`#${topicName} was not created`)
  return id
}

type Members = Partial<Record<'owners' | 'admins' | 'writers' | 'readers', Array<{username: string}>>>

const ensureMember = async (api: ChatApi, team: string, topicName: string, username: string) => {
  const channel = channelRef(team, topicName)
  const members = await api.call<Members>('listmembers', {channel})
  const all = [...(members.owners ?? []), ...(members.admins ?? []), ...(members.writers ?? []), ...(members.readers ?? [])]
  if (all.some(m => m.username === username)) return
  log(`adding the second account to #${topicName}`)
  await api.call('addtochannel', {channel, usernames: [username]})
}

const sendText = async (api: ChatApi, channel: ChannelRef, body: string) =>
  api.call('send', {channel, message: {body}})

const seedLong = async (api: ChatApi, team: string) => {
  const channel = channelRef(team, E2E_CHANNELS.long)
  const have = new Set(
    textBodies(await readAll(api, channel))
      .map(b => /^e2e-long-(\d{4})/.exec(b)?.[1])
      .filter((n): n is string => !!n)
      .map(Number)
  )
  const missing = Array.from({length: LONG_COUNT}, (_, i) => i + 1).filter(i => !have.has(i))
  if (!missing.length) return
  // A run cut short leaves the tail missing; sending it in order keeps the markers in order. A gap
  // in the middle (a single failed send) is filled at the end, out of order, and says so.
  const first = missing[0] ?? 0
  if (missing.some((n, i) => n !== first + i) || (first > 1 && !have.has(first - 1))) {
    log(`#${E2E_CHANNELS.long} has gaps; filling them at the end, out of order`)
  }
  log(`sending ${missing.length} messages to #${E2E_CHANNELS.long}`)
  for (const [n, i] of missing.entries()) {
    await sendText(api, channel, longBody(i))
    if ((n + 1) % 50 === 0) log(`  ${n + 1}/${missing.length}`)
  }
}

const seedShort = async (api: ChatApi, team: string) => {
  const channel = channelRef(team, E2E_CHANNELS.short)
  const have = new Set(textBodies(await readAll(api, channel)).map(b => b.split('\n')[0]))
  const missing = Array.from({length: SHORT_COUNT}, (_, i) => i + 1).filter(i => !have.has(shortMarker(i)))
  if (missing.length) log(`sending ${missing.length} messages to #${E2E_CHANNELS.short}`)
  for (const i of missing) {
    await sendText(api, channel, shortBody(i))
  }
}

const seedSparse = async (api: ChatApi, team: string) => {
  const channel = channelRef(team, E2E_CHANNELS.sparse)
  const have = new Set(textBodies(await readAll(api, channel)))
  if (have.has(sparseMarker(SPARSE_OLDER + SPARSE_NEWER))) return
  if (have.size) throw new Error(`#${E2E_CHANNELS.sparse} was seeded part way; delete the channel and run again`)
  log(`seeding #${E2E_CHANNELS.sparse}`)
  for (let i = 1; i <= SPARSE_OLDER; i++) await sendText(api, channel, sparseMarker(i))
  for (let i = 1; i <= SPARSE_DELETED; i++) {
    const sent = await api.call<{id?: number}>('send', {channel, message: {body: `e2e-sparse-deleted-${i}`}})
    if (!sent.id) throw new Error('a send to the sparse channel returned no message id')
    await api.call('delete', {channel, message_id: sent.id})
  }
  for (let i = SPARSE_OLDER + 1; i <= SPARSE_OLDER + SPARSE_NEWER; i++) await sendText(api, channel, sparseMarker(i))
}

const seedScratch = async (api: ChatApi, team: string) => {
  const channel = channelRef(team, E2E_CHANNELS.scratch)
  const texts = textBodies(await readAll(api, channel))
  const pads = texts.filter(b => b.startsWith('e2e-scratch-pad-')).length
  const short = SCRATCH_MIN_TEXTS - texts.length
  if (short > 0) log(`padding #${E2E_CHANNELS.scratch} with ${short} messages`)
  for (let i = 1; i <= short; i++) {
    await sendText(api, channel, scratchPadMarker(pads + i))
  }
}

const seedReadonly = async (api: ChatApi, team: string) => {
  const channel = channelRef(team, E2E_CHANNELS.readonly)
  const bodies = new Set(textBodies(await readAll(api, channel)))
  for (let i = 1; i <= READONLY_COUNT; i++) {
    if (!bodies.has(readonlyMarker(i))) {
      await sendText(api, channel, readonlyMarker(i))
    }
  }
  const current = await cli(['chat', 'min-writer-role', team, '--channel', E2E_CHANNELS.readonly])
  if (!/\badmin\b/i.test(current)) {
    log(`setting #${E2E_CHANNELS.readonly} min writer role to admin`)
    await cliConfirmed(['chat', 'min-writer-role', team, '--channel', E2E_CHANNELS.readonly, '--role', 'admin'])
    const after = await cli(['chat', 'min-writer-role', team, '--channel', E2E_CHANNELS.readonly])
    if (!/\badmin\b/i.test(after)) throw new Error(`#${E2E_CHANNELS.readonly} min writer role not set: ${after}`)
  }
}

const seedMedia = async (api: ChatApi, team: string) => {
  const channel = channelRef(team, E2E_CHANNELS.media)
  const titles = new Set(
    (await readAll(api, channel))
      .filter(m => m.content.type === 'attachment')
      .map(m => m.content.attachment?.object?.title ?? '')
  )
  for (const {file, title} of MEDIA_FIXTURES) {
    if (!titles.has(title)) {
      log(`attaching ${path.basename(file)} to #${E2E_CHANNELS.media}`)
      await api.call('attach', {channel, filename: file, title})
    }
  }
}

// The smoke user's one-on-one conversation with the second account: its conversation id, and its
// tlf name (both names, sorted), which is what a send to it names.
export type DirectConversation = {convID: string; tlfName: string}

const directTlfName = (a: string, b: string) => [a, b].sort().join(',')

// Reads the conversation's newest message to learn its id; a first send creates it.
const ensureDirect = async (api: ChatApi, smokeUser: string, secondUser: string): Promise<DirectConversation> => {
  const tlfName = directTlfName(smokeUser, secondUser)
  const channel = {name: tlfName}
  const newest = async () => {
    const res = await api.call<{messages?: Array<{msg: {conversation_id: string}}>}>('read', {
      channel,
      pagination: {num: 1},
      peek: true,
    })
    return res.messages?.[0]?.msg.conversation_id
  }
  let convID = await newest().catch(() => undefined)
  if (!convID) {
    log('starting the conversation with the second account')
    await api.call('send', {channel, message: {body: 'e2e-direct-start'}})
    convID = await newest()
  }
  if (!convID) throw new Error('the conversation with the second account was not created')
  return {convID, tlfName}
}

// A subteam of the e2e team that only the owner administers: neither account is in it, so its
// channel is a conversation the second account has never joined and cannot join.
export const CLOSED_SUBTEAM = 'e2eclosed'

// The closed subteam's default channel, created with the subteam when missing.
const ensureClosedChannel = async (api: ChatApi, team: string) => {
  const subteam = `${team}.${CLOSED_SUBTEAM}`
  const find = async () => {
    const res = await api
      .call<{conversations?: Array<ConvSummary>}>('listconvsonname', {members_type: 'team', name: subteam, topic_type: 'CHAT'})
      .catch(() => undefined)
    return res?.conversations?.[0]?.id
  }
  let id = await find()
  if (!id) {
    log(`creating the subteam ${CLOSED_SUBTEAM}`)
    await cli(['team', 'create', subteam])
    id = await find()
  }
  if (!id) throw new Error(`the subteam ${CLOSED_SUBTEAM} has no channel`)
  return id
}

export type ChatData = E2EAccounts & {
  // the closed subteam's channel (see CLOSED_SUBTEAM)
  closedConvID: string
  // conversation id (hex, the app's ConversationIDKey) per channel
  convIDs: Record<E2EChannel, string>
  direct: DirectConversation
}

let ensured: Promise<ChatData> | undefined

// Creates and seeds whatever is missing. Cached per process: one check per test run.
export const ensureChatData = async (): Promise<ChatData> => {
  ensured ??= (async () => {
    const accounts = e2eAccounts()
    const {secondUser, team} = accounts
    const api = new ChatApi()
    try {
      const convIDs = {} as Record<E2EChannel, string>
      for (const topicName of Object.values(E2E_CHANNELS)) {
        convIDs[topicName] = await ensureChannel(api, team, topicName)
        await ensureMember(api, team, topicName, secondUser)
      }
      await seedLong(api, team)
      await seedShort(api, team)
      await seedSparse(api, team)
      await seedScratch(api, team)
      await seedReadonly(api, team)
      await seedMedia(api, team)
      const direct = await ensureDirect(api, accounts.smokeUser, secondUser)
      const closedConvID = await ensureClosedChannel(api, team)
      return {...accounts, closedConvID, convIDs, direct}
    } finally {
      api.close()
    }
  })()
  return ensured
}

const withApi = async <R>(f: (api: ChatApi) => Promise<R>) => {
  const api = new ChatApi()
  try {
    return await f(api)
  } finally {
    api.close()
  }
}

// A text message sent through the host's CLI (not the app under test), as whichever account the
// CLI is signed in as: the smoke user for the desktop flows, the second account for the iOS ones
// (see cli-account.ts).
export const sendFromCli = async (topicName: E2EChannel, body: string) => {
  const {team} = e2eAccounts()
  await withApi(async api => sendText(api, channelRef(team, topicName), body))
}

// The same into a channel createThrowawayChannel made in this run, named exactly.
export const sendToThrowawayFromCli = async (topicName: string, body: string) => {
  if (parseStampedName(topicName, 'dashed')?.runId !== currentRunId()) throw new Error(`#${topicName} is not a channel of this run`)
  const {team} = e2eAccounts()
  await withApi(async api => sendText(api, channelRef(team, topicName), body))
}

// A text message sent through the host's CLI to a one-on-one conversation, named by its tlf name.
export const sendDirectFromCli = async (tlfName: string, body: string) => {
  await withApi(async api => api.call('send', {channel: {name: tlfName}, message: {body}}))
}

// An image sent through the host's CLI, titled `title`.
export const attachFromCli = async (topicName: E2EChannel, title: string) => {
  const {team} = e2eAccounts()
  const image = MEDIA_FIXTURES[1]
  await withApi(async api => api.call('attach', {channel: channelRef(team, topicName), filename: image.file, title}))
}

// The newest `num` messages of an e2e team channel, or of a one-on-one conversation named by its
// tlf name, newest first, read through the host's CLI. Peeks, so reading does not mark it read.
export const readFromCli = async (where: {topicName: string} | {tlfName: string}, num = 50): Promise<Array<CliMessage>> => {
  const {team} = e2eAccounts()
  const channel = 'topicName' in where ? channelRef(team, where.topicName) : {name: where.tlfName}
  const res = await withApi(async api => api.call<ReadResult>('read', {channel, pagination: {num}, peek: true}))
  return (res.messages ?? []).map(m => m.msg)
}

// The bot commands offered in a channel (none unless the team has a bot installed).
export const botCommands = async (topicName: E2EChannel) => {
  const {team} = e2eAccounts()
  type Commands = {
    commands?: Array<{extended_description?: {title?: string} | null; name: string; username: string}> | null
  }
  const res = await withApi(async api => api.call<Commands>('listcommands', {channel: channelRef(team, topicName)}))
  return (res.commands ?? []).filter(c => !!c.username)
}

const currentRunId = () => {
  const id = runIdFromEnv(process.env)
  if (!id) throw new Error('KB_E2E_RUN_ID is not set: the run entry point sets it before any test')
  return id
}

// A channel for one run's membership flows, named stampedChannelName(label + 2 random hex
// characters) (so the label is at most 7 characters; the random part keeps a retry from meeting a
// channel an earlier try failed to delete), created by the CLI's account (the team owner for the
// desktop flows, the second account, a writer, for the iOS ones) with the second account in it,
// unless `withSecond` is false. Throws when the channel already exists. Callers delete it by the
// returned topicName.
export const createThrowawayChannel = async (label: string, {withSecond = true}: {withSecond?: boolean} = {}) => {
  const {secondUser, team} = e2eAccounts()
  const topicName = stampedChannelName(`${label}${randomBytes(1).toString('hex')}`, currentRunId())
  const convID = await withApi(async api => {
    if ((await listChannels(api, team)).has(topicName)) throw new Error(`#${topicName} already exists`)
    const id = await ensureChannel(api, team, topicName)
    if (withSecond) await ensureMember(api, team, topicName, secondUser)
    return id
  })
  return {convID, topicName}
}

// Every member of a team channel, by username, read through the host's CLI.
export const channelMembersFromCli = async (topicName: string) => {
  const {team} = e2eAccounts()
  const members = await withApi(async api => api.call<Members>('listmembers', {channel: channelRef(team, topicName)}))
  return [...(members.owners ?? []), ...(members.admins ?? []), ...(members.writers ?? []), ...(members.readers ?? [])].map(m => m.username)
}

// The lowest team role that can post in a team channel, as the CLI prints it.
export const minWriterRoleFromCli = async (topicName: string) => {
  const {team} = e2eAccounts()
  return cli(['chat', 'min-writer-role', team, '--channel', topicName])
}

// The CLI's account leaves a team channel.
export const leaveChannelFromCli = async (topicName: string) => {
  const {team} = e2eAccounts()
  await withApi(async api => api.call('leave', {channel: channelRef(team, topicName)}))
}

// Sets the lowest team role that can post in a team channel, through the CLI, which must be signed
// in as a team admin. 'none' clears it.
export const setMinWriterRoleFromCli = async (topicName: string, role: 'admin' | 'none' | 'writer') => {
  const {team} = e2eAccounts()
  // the prompt wraps at the terminal's width, which splits 'confirm' for some role names
  await cliConfirmed(['chat', 'min-writer-role', team, '--channel', topicName, '--role', role], 'Hit Enter')
  const shows = role === 'none' ? /\bnot set\b/i : new RegExp(`\\b${role}\\b`, 'i')
  // the read can lag the set by a moment
  const deadline = Date.now() + 15_000
  for (;;) {
    const now = await minWriterRoleFromCli(topicName)
    if (shows.test(now)) return
    if (Date.now() > deadline) throw new Error(`#${topicName} min writer role not ${role}: ${now}`)
    await sleep(1_000)
  }
}

// Deletes one channel createThrowawayChannel made in this run, by its exact name, through the CLI,
// which must be signed in as the team owner. Earlier runs' channels are the sweeper's. Does nothing
// when the channel is not there (its create failed, or it was already deleted).
export const deleteThrowawayChannel = async (topicName: string) => {
  const {team} = e2eAccounts()
  const stamp = parseStampedName(topicName, 'dashed')
  if (stamp?.runId !== currentRunId()) throw new Error(`refusing to delete #${topicName}: not a channel of this run`)
  if (!(await withApi(async api => listChannels(api, team))).has(topicName)) return
  log(`deleting #${topicName}`)
  await cliConfirmed(['chat', 'delete-channel', team, topicName], 'please type:', `nuke ${topicName}`)
}

// The id of a one-on-one conversation (or the self conversation, named by the user alone), read
// from its newest message through the host's CLI. Peeks.
export const directConvIDFromCli = async (tlfName: string) => {
  const res = await withApi(async api =>
    api.call<{messages?: Array<{msg: {conversation_id: string}}>}>('read', {channel: {name: tlfName}, pagination: {num: 1}, peek: true})
  )
  const id = res.messages?.[0]?.msg.conversation_id
  if (!id) throw new Error('the conversation has no messages to read its id from')
  return id
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// The server's passing refusals: a gateway's HTTP status line, or a team changed by another call a
// moment ago.
const transientRe = /\b50[234] (?:Bad Gateway|Service Unavailable|Gateway Time-?out)\b|team sigchain is being rapidly updated/i

// Runs a CLI call `f`, again (up to 4 times, 5s apart) when the server refused it in passing. An
// error matching `doneRe` on a later attempt means an earlier one took effect after all.
export const retryTransient = async <R,>(f: () => Promise<R>, doneRe?: RegExp): Promise<R | undefined> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await f()
    } catch (e) {
      const msg = message(e)
      if (attempt > 1 && doneRe?.test(msg)) return undefined
      if (attempt >= 4 || !transientRe.test(msg)) throw e
      log(`retrying after a passing server refusal: ${msg.split('\n')[0]?.slice(-120) ?? ''}`)
      await sleep(5_000)
    }
  }
}

// A subteam of the e2e team for one run's flows, `<KB_E2E_TEAM>.<stampedTeamName(label)>` (so the
// label is at most 7 characters), created by the CLI's account, which must be the smoke account (a team
// admin), and joined by it as an admin: its creator is otherwise only an implicit admin, outside
// its channels.
// Returns its name and its general channel's id. Throws when it already exists; a subteam it made
// but could not finish setting up is deleted again before it throws.
export const createThrowawaySubteam = async (label: string) => {
  const {smokeUser, team} = e2eAccounts()
  const part = stampedTeamName(label, currentRunId())
  const name = `${team}.${part}`
  // a create the server answered with a gateway error can still have happened
  await retryTransient(async () => cli(['team', 'create', name]), /already exists|name is taken/i)
  try {
    await retryTransient(async () => cli(['team', 'add-member', name, `--user=${smokeUser}`, '--role=admin']), /already a member/i)
    // a small team's only channel has no topic name; a new team's channel can take a few seconds
    // to be listed
    const generalConvID = await withApi(async api => {
      const deadline = Date.now() + 30_000
      for (;;) {
        const channels = await listChannels(api, name)
        const id = channels.get('general') ?? channels.get('')
        if (id || Date.now() > deadline) return id
        await sleep(1_000)
      }
    })
    if (!generalConvID) throw new Error(`the subteam ${part} has no general channel`)
    return {generalConvID, name}
  } catch (e) {
    try {
      await deleteThrowawaySubteam(name)
    } catch (cleanup) {
      throw new AggregateError([e, cleanup], `${message(e)}; and then deleting the subteam ${part} failed: ${message(cleanup)}`, {cause: cleanup})
    }
    throw e
  }
}

// Deletes one subteam createThrowawaySubteam made in this run, by its exact name, through the CLI,
// which must be signed in as a team admin. Earlier runs' subteams are the sweeper's.
export const deleteThrowawaySubteam = async (name: string) => {
  const {team} = e2eAccounts()
  const part = name.startsWith(`${team}.`) ? name.slice(team.length + 1) : ''
  if (parseStampedName(part, 'team')?.runId !== currentRunId()) throw new Error(`refusing to delete ${part || 'a team'}: not a subteam of this run`)
  log(`deleting the subteam ${part}`)
  await cliConfirmed(['team', 'delete', name], 'please type:', `nuke ${name}`)
}
