// Seeded chat data for the chat e2e flows, created through the local `keybase` CLI against the
// running service (signed in as KB_SMOKE_USER, who owns KB_E2E_TEAM). Every step checks what is
// already there first, so running it again only fills in what is missing. Node-only: shared by
// the Electron flows and, later, the iOS ones (both drive a host that has the CLI).
//
// Accounts and the team come from the environment, never from this file:
//   KB_SMOKE_USER  the account the app under test is signed in as, and the team owner
//   KB_SECOND_USER a second account, a writer in the team (sends "incoming" messages)
//   KB_E2E_TEAM    the team the e2e channels live in
import {spawn, execFile, type ChildProcessWithoutNullStreams} from 'child_process'
import * as path from 'path'
import * as readline from 'readline'

export type E2EAccounts = {smokeUser: string; secondUser: string; team: string}

export const e2eAccounts = (): E2EAccounts => {
  const smokeUser = process.env['KB_SMOKE_USER']
  const secondUser = process.env['KB_SECOND_USER']
  const team = process.env['KB_E2E_TEAM']
  const missing = [
    ['KB_SMOKE_USER', smokeUser],
    ['KB_SECOND_USER', secondUser],
    ['KB_E2E_TEAM', team],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (!smokeUser || !secondUser || !team) {
    throw new Error(`chat e2e data needs ${missing.join(', ')} set in the environment`)
  }
  return {secondUser, smokeUser, team}
}

export const E2E_CHANNELS = {
  long: 'e2e-long',
  media: 'e2e-media',
  // min writer role admin: the second account (a writer) can read it but not post
  readonly: 'e2e-readonly',
  scratch: 'e2e-scratch',
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

export const READONLY_COUNT = 3
export const readonlyMarker = (index: number) => `e2e-readonly-${String(index).padStart(4, '0')}`

// e2e runners start in shared/
const fixturesDir = path.resolve('tests/e2e/fixtures')
export const MEDIA_FIXTURES = [
  {file: path.join(fixturesDir, 'e2e-video.mp4'), title: 'e2e-media-video'},
  {file: path.join(fixturesDir, 'e2e-image.png'), title: 'e2e-media-image'},
  {file: path.join(fixturesDir, 'e2e-file.txt'), title: 'e2e-media-file'},
] as const

const log = (line: string) => {
  console.log(`[chat-data] ${line}`)
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const keybaseBin = () => process.env['KB_CLI'] ?? 'keybase'

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
      attachment?: {object?: {title?: string}}
    }
    sender: {username: string}
  }
}

type ReadResult = {
  messages?: Array<ApiMessage>
  pagination?: {next?: string; last?: boolean}
}

type ConvSummary = {id: string; channel: {topic_name?: string}}

class RateLimited extends Error {}

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
    const next = await this.lines.next()
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
    execFile(keybaseBin(), args, {encoding: 'utf8'}, (err, stdout, stderr) => {
      if (err) reject(new Error(`keybase ${args.join(' ')}: ${stderr || err.message}`))
      else resolve(`${stdout}${stderr}`)
    })
  })

// Setting a min writer role always asks for confirmation on /dev/tty, so it runs under `script`
// (a pseudo-terminal) and answers the prompt when it appears.
const cliConfirmed = async (args: Array<string>) =>
  new Promise<void>((resolve, reject) => {
    const proc = spawn('script', ['-q', '/dev/null', keybaseBin(), ...args])
    let output = ''
    let answered = false
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`keybase ${args.join(' ')} timed out: ${output}`))
    }, 30_000)
    proc.stdout.on('data', (d: Buffer) => {
      output += d.toString()
      if (!answered && output.includes('Hit Enter to confirm')) {
        answered = true
        proc.stdin.write('\r')
      }
    })
    proc.on('exit', code => {
      clearTimeout(timer)
      if (code === 0 && answered) resolve()
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

export type ChatData = E2EAccounts & {
  // conversation id (hex, the app's ConversationIDKey) per channel
  convIDs: Record<E2EChannel, string>
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
      await seedReadonly(api, team)
      await seedMedia(api, team)
      return {...accounts, convIDs}
    } finally {
      api.close()
    }
  })()
  return ensured
}

// A text message sent as the smoke user through the CLI (not the app under test).
export const sendAsSmokeUser = async (topicName: E2EChannel, body: string) => {
  const {team} = e2eAccounts()
  const api = new ChatApi()
  try {
    await sendText(api, channelRef(team, topicName), body)
  } finally {
    api.close()
  }
}
