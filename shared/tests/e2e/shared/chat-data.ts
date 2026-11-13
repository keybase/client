// Seeded chat data for the chat e2e flows, created through the local `keybase` CLI against the
// running service (signed in as KB_SMOKE_USER, who owns KB_E2E_TEAM). Every step checks what is
// already there first, so running it again only fills in what is missing. Node-only: shared by
// the Electron and iOS flows (both drive a host that has the CLI, signed in as KB_SMOKE_USER).
//
// Accounts and the team come from the environment or ~/.config/keybase-e2e/env, never from this file:
//   KB_SMOKE_USER  the account the app under test is signed in as, and the team owner
//   KB_SECOND_USER a second account, a writer in the team (sends "incoming" messages from its peer
//                  service, peer-actors.ts)
//   KB_E2E_TEAM    the team the e2e channels live in
import {spawn, type ChildProcessWithoutNullStreams} from 'child_process'
import {randomBytes} from 'crypto'
import * as path from 'path'
import * as readline from 'readline'
import {loadE2EAccounts, type E2EAccounts} from '../accounts/env.ts'
import {parseStampedName, runIdFromEnv, stampedChannelName, stampedTeamName} from '../accounts/run-id.ts'
import {CORPUS, corpusEntry} from '../fixtures/corpus/corpus.ts'
import {runCli} from './cli-read.ts'
import {expectSpawnList, keybaseBin} from './keybase-bin.ts'
import {requireMainIsSmoke} from './peer-service.ts'

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
const longBody = (index: number) => {
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
const SPARSE_DELETED = 18
export const SPARSE_NEWER = 2
export const sparseMarker = (index: number) => `e2e-sparse-${String(index).padStart(4, '0')}`

// e2e-scratch keeps at least this many text messages, so the scroll flows that post to it have
// history above the viewport to scroll into from the first run on.
const SCRATCH_MIN_TEXTS = 60
const scratchPadMarker = (index: number) => `e2e-scratch-pad-${String(index).padStart(4, '0')}`

const READONLY_COUNT = 3
export const readonlyMarker = (index: number) => `e2e-readonly-${String(index).padStart(4, '0')}`

// e2e runners start in shared/
const fixturesDir = path.resolve('tests/e2e/fixtures')
export const MEDIA_FIXTURES = [
  // 480x640: its preview is 320px tall, so the middle of the video sits above the desktop video's
  // own control bar (the bottom ~72px), where a press never reaches the page
  {file: path.join(fixturesDir, 'e2e-video.mp4'), title: 'e2e-media-video-tall'},
  {file: path.join(fixturesDir, 'e2e-image.png'), title: 'e2e-media-image'},
  {file: path.join(fixturesDir, 'e2e-file.txt'), title: 'e2e-media-file'},
  // the pdf the visual tour's modal/chat-pdf shows
  {file: corpusEntry('e2e-c.pdf').file, title: 'e2e-media-pdf'},
] as const

const log = (line: string) => {
  console.log(`[chat-data] ${line}`)
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// -- chat api -------------------------------------------------------------------------------------

type ApiError = {code?: number; message: string}
type ApiResponse<R> = {error?: ApiError; result?: R}

type ChannelRef = {members_type: 'team'; name: string; topic_name: string}

// A message the API could not unbox comes as {error} with no msg.
type ApiMessage = {
  error?: string
  msg?: {
    id: number
    content: {
      type: string
      text?: {body: string}
      attachment?: {object?: {filename?: string; mimeType?: string; title?: string}}
    }
    // each emoji's reactions, by the usernames that reacted
    reactions?: {reactions?: Record<string, {users?: Record<string, unknown> | null}> | null} | null
    sender: {username: string}
    // when the server took it, in its own clock
    sent_at_ms?: number
  }
}
export type CliMessage = NonNullable<ApiMessage['msg']>

export type ReadResult = {
  messages?: Array<ApiMessage>
  pagination?: {next?: string; last?: boolean}
}

// A read's messages, newest first, leaving out those the API could not unbox (the app draws no row
// for one).
const unboxed = (res: ReadResult): Array<CliMessage> => (res.messages ?? []).flatMap(m => (m.msg ? [m.msg] : []))

type ConvSummary = {id: string; channel: {topic_name?: string}}

class RateLimited extends Error {}

// How long one keybase CLI call or chat api request may take before it counts as stuck.
const cliTimeoutMs = 60_000

const isRateLimit = (e: ApiError) => e.code === 2501 || /rate limit/i.test(e.message)
// A 5xx gateway answer: the server's gateway failing for a moment, gone in seconds.
export const GATEWAY_ERROR_RE = /\b50[234]\b|Bad Gateway|Service Unavailable|Gateway Time-?out/i
// The main service mid account switch (an earlier flow switching back to the smoke account): the
// call never reached the server, gone in seconds.
const LOGIN_REQUIRED_RE = /Login required/i
const TRANSIENT_WAITS_MS = [2_000, 5_000, 10_000]
// Calls that change nothing, so tried again after a gateway error: a write may have landed before
// the gateway failed, and sending it again would post it twice.
const READ_METHODS = new Set(['listcommands', 'listconvsonname', 'listmembers', 'read'])

class Transient extends Error {}

// One long-lived `keybase chat api` process: it reads a stream of requests on stdin and answers
// each with one line on stdout, so seeding does not pay a process start per message.
class ChatApi {
  private proc: ChildProcessWithoutNullStreams
  private lines: AsyncIterator<string>

  constructor() {
    this.proc = spawn(keybaseBin(), ['chat', 'api'])
    this.lines = readline.createInterface({input: this.proc.stdout})[Symbol.asyncIterator]()
  }

  private async callOnce<R>(method: string, options: object, timeoutMs = cliTimeoutMs): Promise<R> {
    this.proc.stdin.write(`${JSON.stringify({method, params: {options}})}\n`)
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        // its answer can no longer be matched to its call, so the process goes with it
        this.proc.kill()
        reject(new Error(`keybase chat api ${method}: no answer in ${timeoutMs / 1000}s`))
      }, timeoutMs)
    })
    const next = await Promise.race([this.lines.next(), timeout]).finally(() => clearTimeout(timer))
    if (next.done) {
      throw new Error(`keybase chat api exited during ${method}`)
    }
    const res = JSON.parse(next.value) as ApiResponse<R>
    if (res.error) {
      if (isRateLimit(res.error)) throw new RateLimited(res.error.message)
      if (LOGIN_REQUIRED_RE.test(res.error.message) || (READ_METHODS.has(method) && GATEWAY_ERROR_RE.test(res.error.message))) {
        throw new Transient(`chat api ${method}: ${res.error.message}`)
      }
      throw new Error(`chat api ${method}: ${res.error.message}`)
    }
    return res.result as R
  }

  // One try with its own deadline, for a read polled by a caller that bounds its own wait: a rate
  // limit is thrown like any other error.
  async callWithin<R>(method: string, options: object, timeoutMs: number): Promise<R> {
    return this.callOnce<R>(method, options, timeoutMs)
  }

  // Retries rate-limit errors (the service allows about 9000 chat calls per 15 minutes), waiting
  // longer each time, for up to the length of one window; and transient ones a few times.
  async call<R>(method: string, options: object): Promise<R> {
    let waitMs = 30_000
    let waited = 0
    let transientTries = 0
    for (;;) {
      try {
        return await this.callOnce<R>(method, options)
      } catch (e) {
        if (e instanceof Transient && transientTries < TRANSIENT_WAITS_MS.length) {
          const wait = TRANSIENT_WAITS_MS[transientTries++]!
          log(`${e.message}; trying again in ${wait / 1000}s`)
          await sleep(wait)
          continue
        }
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
  runCli(args, `keybase ${args.join(' ')}`, {timeoutMs: cliTimeoutMs, withStderr: true})

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
      KB_CONFIRM_CMD: expectSpawnList([keybaseBin(), ...args], `keybase ${args[0] ?? ''}`),
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
    proc.on('error', e => {
      clearTimeout(timer)
      reject(new Error(`keybase ${args.join(' ')} could not run under expect: ${e.message}`))
    })
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
  const out: Array<CliMessage> = []
  let next: string | undefined
  for (;;) {
    const res = await api.call<ReadResult>('read', {
      channel,
      pagination: next ? {next, num: 500} : {num: 500},
      peek: true,
    })
    out.push(...unboxed(res))
    if (!res.pagination?.next || res.pagination.last || !res.messages?.length) break
    next = res.pagination.next
  }
  return out.reverse()
}

const textBodies = (msgs: ReadonlyArray<CliMessage>) =>
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

// The text a scratch anchor carries: unstamped, so the sweeper never deletes it.
const SCRATCH_ANCHOR = 'e2e scratch anchor'
// The page of newest messages the app loads when it opens a thread.
const THREAD_PAGE = 60
// What the app draws a row for: Go's chat1 visibleMessageTypes (go/protocol/chat1/extras.go:237),
// and metadata, which the thread load asks for (threadLoadMessageTypes in
// chat/conversation/chat-rpc.tsx) and uiMessageToMessage (constants/chat/message.tsx) makes a
// channel rename row.
const ROW_TYPES = new Set([
  'text',
  'attachment',
  'join',
  'leave',
  'system',
  'sendpayment',
  'requestpayment',
  'flip',
  'headline',
  'pin',
  'metadata',
])

// The newest message of a read that the app draws a row for.
export const newestDrawn = (res: ReadResult) => unboxed(res).find(m => ROW_TYPES.has(m.content.type))

// The sweeper deletes the stamped messages each run posts to scratch, so its newest page can fill up
// with deletes; the app then opens the thread with no row and never pages further back (PR 9). When
// the newest page has nothing the app draws, the host posts one unstamped anchor as the smoke account
// (from the host, never the app, so it counts as no coverage) and reads it back.
const anchorScratch = async (api: ChatApi, team: string) => {
  const channel = channelRef(team, E2E_CHANNELS.scratch)
  const newest = async () => api.call<ReadResult>('read', {channel, pagination: {num: THREAD_PAGE}, peek: true})
  if (newestDrawn(await newest())) return
  log(`anchoring #${E2E_CHANNELS.scratch}: its newest page is all deletes`)
  await sendText(api, channel, SCRATCH_ANCHOR)
  const top = newestDrawn(await newest())
  if (top?.content.text?.body !== SCRATCH_ANCHOR) throw new Error(`#${E2E_CHANNELS.scratch}'s anchor did not land as its newest message`)
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
type DirectConversation = {convID: string; tlfName: string}

export const directTlfName = (a: string, b: string) => [a, b].sort().join(',')

// Reads the conversation's newest message to learn its id; a first send creates it.
const ensureDirect = async (api: ChatApi, smokeUser: string, secondUser: string): Promise<DirectConversation> => {
  const tlfName = directTlfName(smokeUser, secondUser)
  const channel = {name: tlfName}
  const newest = async () => {
    const res = await api.call<{messages?: Array<{msg?: {conversation_id: string}}>}>('read', {
      channel,
      pagination: {num: 1},
      peek: true,
    })
    return res.messages?.[0]?.msg?.conversation_id
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

// Runs `make` once per process and hands back its promise to every caller; a failed run is not kept,
// so the next test checks again rather than failing on this one's error.
const onceUnlessFailed = <R,>(make: () => Promise<R>) => {
  let p: Promise<R> | undefined
  return async () => {
    if (!p) {
      const mine = make()
      p = mine
      mine.catch(() => {
        if (p === mine) p = undefined
      })
    }
    return p
  }
}

// Creates and seeds whatever is missing. Cached per process: one check per test run.
export const ensureChatData = onceUnlessFailed(async (): Promise<ChatData> => {
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
      await anchorScratch(api, team)
      await seedReadonly(api, team)
      await seedMedia(api, team)
      const direct = await ensureDirect(api, accounts.smokeUser, secondUser)
      const closedConvID = await ensureClosedChannel(api, team)
      return {...accounts, closedConvID, convIDs, direct}
    } finally {
      api.close()
    }
})

const withApi = async <R>(f: (api: ChatApi) => Promise<R>) => {
  const api = new ChatApi()
  try {
    return await f(api)
  } finally {
    api.close()
  }
}

// A text message sent through the host's CLI (not the app under test), as the smoke user: on the
// phone that is the account's own message from another device, not an incoming one (peer-actors.ts
// sends those).
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

// A corpus file (fixtures/corpus) sent through the host's CLI into a channel
// createThrowawayChannel made in this run, titled `title`: the smoke user's own attachment from
// another device.
export const attachToThrowawayFromCli = async (topicName: string, file: string, title: string) => {
  if (parseStampedName(topicName, 'dashed')?.runId !== currentRunId()) throw new Error(`#${topicName} is not a channel of this run`)
  if (!CORPUS.some(c => c.file === file)) throw new Error(`${file} is not a corpus file`)
  const {team} = e2eAccounts()
  await withApi(async api => api.call('attach', {channel: channelRef(team, topicName), filename: file, title}))
}

// The newest `num` messages of an e2e team channel, or of a one-on-one conversation named by its
// tlf name, newest first, read through the host's CLI. Peeks, so reading does not mark it read.
export const readFromCli = async (where: {topicName: string} | {tlfName: string}, num = 50): Promise<Array<CliMessage>> => {
  const {team} = e2eAccounts()
  const channel = 'topicName' in where ? channelRef(team, where.topicName) : {name: where.tlfName}
  const res = await withApi(async api => api.call<ReadResult>('read', {channel, pagination: {num}, peek: true}))
  return unboxed(res)
}

// The attachment of message `id` (in a conversation as readFromCli names it), downloaded through the
// host's CLI to `file`. Bound: one call of 60s.
export const downloadFromCli = async (where: {topicName: string} | {tlfName: string}, id: number, file: string) => {
  const {team} = e2eAccounts()
  const channel = 'topicName' in where ? channelRef(team, where.topicName) : {name: where.tlfName}
  await withApi(async api => api.callWithin('download', {channel, message_id: id, output: file}, 60_000))
}

// Deletes message `id` (in a conversation as readFromCli names it) through the host's CLI, for a
// flow's own message that carries no run stamp at its start (the sweeper finds a message by that).
// Bound: one call of 60s.
export const deleteFromCli = async (where: {topicName: string} | {tlfName: string}, id: number) => {
  const {team} = e2eAccounts()
  const channel = 'topicName' in where ? channelRef(team, where.topicName) : {name: where.tlfName}
  await withApi(async api => api.callWithin('delete', {channel, message_id: id}, 60_000))
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
// channel an earlier try failed to delete), created by the host CLI's account (the smoke user, the
// team owner) with the second account in it, unless `withSecond` is false. Throws when the channel
// already exists. Callers delete it by the returned topicName.
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

// Whether the host's account has an e2e team channel unread, as its inbox holds it: its read pointer
// is behind the newest visible message, its own messages included (a mark unread from another device
// moves the pointer back; opening the thread there moves it forward). One try, bounded: the host
// check 15s, the read `timeoutMs`; callers poll it within their own deadline.
export const channelUnreadFromCli = async (topicName: E2EChannel, timeoutMs = 10_000) => {
  const accounts = e2eAccounts()
  await requireMainIsSmoke(accounts)
  const {team} = accounts
  const res = await withApi(async api =>
    api.callWithin<{conversations?: Array<ConvSummary & {unread?: boolean}>}>('listconvsonname', {
      members_type: 'team',
      name: team,
      topic_type: 'CHAT',
    }, timeoutMs)
  )
  const conv = (res.conversations ?? []).find(c => c.channel.topic_name === topicName)
  if (!conv) throw new Error(`#${topicName} is not among the team's channels`)
  return conv.unread === true
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

// Thrown by directConvIDFromCli for a conversation with no id to read yet: never created (the chat
// API answers "no conversations matched"), or created with no messages.
export class NoMessagesYet extends Error {
  constructor() {
    super('the conversation does not exist yet or has no messages to read its id from')
  }
}

// What directConvIDFromCli throws for its read failing with `e`: NoMessagesYet for a conversation
// that does not exist, else the error with the conversation's name and each account in it masked
// (the CLI echoes the name it was given).
export const directReadFailure = (e: unknown, tlfName: string): Error => {
  const text = e instanceof Error ? e.message : String(e)
  if (text.includes('no conversations matched')) return new NoMessagesYet()
  const names = [tlfName, ...tlfName.split(',')].filter(Boolean).sort((a, b) => b.length - a.length)
  return new Error(`reading the conversation's id failed: ${names.reduce((t, n) => t.split(n).join('<name>'), text)}`)
}

// The id of a one-on-one conversation (or the self conversation, named by the user alone), read
// from its newest message through the host's CLI. Peeks.
export const directConvIDFromCli = async (tlfName: string) => {
  const res = await withApi(async api =>
    api.call<{messages?: Array<{msg?: {conversation_id: string}}>}>('read', {channel: {name: tlfName}, pagination: {num: 1}, peek: true})
  ).catch((e: unknown) => {
    throw directReadFailure(e, tlfName)
  })
  const id = res.messages?.[0]?.msg?.conversation_id
  if (!id) throw new NoMessagesYet()
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
      const reason = transientRe.exec(msg)?.[0]
      if (attempt >= 4 || !reason) throw e
      // only the matched reason: the rest of a CLI's error can quote a team's name or what it printed
      log(`retrying after a passing server refusal: ${reason}`)
      await sleep(5_000)
    }
  }
}

// A subteam of the e2e team for one run's flows, `<KB_E2E_TEAM>.<stampedTeamName(label)>` (so the
// label is at most 7 characters), created by the CLI's account, which must be the smoke account (a team
// admin), and kept in it as an admin: its creator is otherwise only an implicit admin, outside its
// channels. The create keeps the creator in (--join-subteam, as a writer), as leaving and joining again
// costs ~5s of every subteam.
// Returns its name and its general channel's id. Throws when it already exists; a subteam it made
// but could not finish setting up is deleted again before it throws.
export const createThrowawaySubteam = async (label: string) => {
  const {smokeUser, team} = e2eAccounts()
  const part = stampedTeamName(label, currentRunId())
  const name = `${team}.${part}`
  // a create the server answered with a gateway error can still have happened
  await retryTransient(async () => cli(['team', 'create', '--join-subteam', name]), /already exists|name is taken/i)
  try {
    await retryTransient(async () => cli(['team', 'edit-member', name, `--user=${smokeUser}`, '--role=admin']))
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
