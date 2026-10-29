// yarn test:e2e:accounts:sweep [--dry-run]
//
// Removes what earlier e2e runs left behind in the test accounts (see sweep-lib.ts for which names
// qualify). The smoke account acts through the main service, which must be signed in as it; the
// second account through its peer service. For each account it lists:
//   its own messages in the scratch channel, the smoke<->second conversation and (smoke) the self
//   conversation; personal git repos, emails, root teams it owns, devices and paper keys; and,
//   smoke only (deleting needs a team admin; peer services run no KBFS): team channels, subteams,
//   emoji and team repos of KB_E2E_TEAM, and KBFS entries directly in the folders kbfsRoots names.
// A stale e2e-<runid>-prov device is revoked after its home (homes/prov-<runid>) is shut down and
// removed (or, its home already gone, once no service for it runs); a paper key only when the
// ledger (paper-key-ledger.ts) recorded it.
// Each delete first re-checks the acting account and the name, targets one exact object and never
// recurses: a KBFS directory goes only when empty, a team only once its subteams are gone. Exits 1
// when a listing or a delete failed. An aborted sweep (sweep's `signal`) stops between listings and
// deletes, rejecting with the signal's reason.
import {spawn} from 'child_process'
import * as fs from 'fs'
import {pathToFileURL} from 'url'
import {parseArgs} from 'util'
import {checkNotProtectedPaperKey, protectedPaperKeyIn} from './device-targets.ts'
import {defaultPeerHome, loadE2EEnv, provisionHomeFor, type E2EEnv, type PeerRole} from './env.ts'
import {forgetPaperKey, readPaperKeys} from './paper-key-ledger.ts'
import {
  checkRevocable,
  readPeerConfig,
  removeRetiredPeerHome,
  retirePeerHome,
  revokeWithHomeStopped,
  serviceProcessesFor,
  stopPeerHomeService,
} from './peer-homes.ts'
import {
  candidateKey,
  checkDelete,
  describeCandidate,
  kbfsRoots,
  listedEmojiAlias,
  maskAccounts,
  parseKbfsLs,
  selectSweepTargets,
  type SweepAccount,
  type SweepCandidate,
  type SweepKind,
  type SweepContext,
  type SweepNote,
} from './sweep-lib.ts'
import {ensureRunId, parseStampedName} from './run-id.ts'
import {CLOSED_SUBTEAM, E2E_CHANNELS} from '../shared/chat-data.ts'
import {convIDBytes} from '../shared/conv-id.ts'
import {keybaseBin} from '../shared/keybase-bin.ts'
import {connectPeerRpc, type PeerRpc} from '../shared/peer-rpc.ts'
import {
  ensurePeer,
  mainSocketPath,
  mainWhoami,
  peerConfigPath,
  redactSecrets,
  requireMainIsSmoke,
  runKeybase,
  socketAnswers,
  socketPathFor,
} from '../shared/peer-service.ts'

type Actor = {
  account: SweepAccount
  user: string
  // global flags that point the CLI at this account's service
  cliFlags: Array<string>
  // the peer role whose home holds this account's current peer device
  peerRole: PeerRole
  whoami: () => Promise<string>
  cli: (args: string[], timeoutMs: number) => Promise<string>
  rpc: () => Promise<PeerRpc>
}

export type SweepResult = {
  deleted: Array<SweepCandidate>
  wouldDelete: Array<SweepCandidate>
  listOnly: Array<SweepNote>
  kept: Array<SweepNote>
  // what the sweep does not cover, said out loud
  notes: Array<string>
  // a listing or a delete that failed, each naming what it was
  errors: Array<string>
}

const rpcTimeoutMs = 30_000
const kbfsTimeoutMs = 45_000

const withRpc = async <R,>(actor: Actor, f: (rpc: PeerRpc) => Promise<R>) => {
  const rpc = await actor.rpc()
  try {
    return await f(rpc)
  } finally {
    rpc.close()
  }
}

const call = async <T,>(actor: Actor, method: string, arg: object) =>
  withRpc(actor, async rpc => rpc.call<T>(method, arg, rpcTimeoutMs))

const mainActor = (env: E2EEnv): Actor => ({
  account: 'smoke',
  cliFlags: [],
  cli: async (args, timeoutMs) => runKeybase(args, {timeoutMs}),
  peerRole: 'owner',
  rpc: async () => connectPeerRpc(mainSocketPath(), 10_000),
  user: env.smokeUser,
  whoami: async () => mainWhoami().catch(() => ''),
})

const secondActor = async (env: E2EEnv): Promise<Actor> => {
  const peer = await ensurePeer('second', env)
  return {
    account: 'second',
    cli: peer.cli,
    cliFlags: ['--home', peer.home],
    peerRole: 'second',
    rpc: peer.rpc,
    user: peer.user,
    whoami: async () => peer.cli(['whoami'], 15_000).catch(() => ''),
  }
}

type ConvSummary = {id: string; channel: {topic_name?: string}}

const chatApi = async <R,>(actor: Actor, method: string, options: object, timeoutMs = 60_000): Promise<R> => {
  const out = await actor.cli(['chat', 'api', '-m', JSON.stringify({method, params: {options}})], timeoutMs)
  const reply = JSON.parse(out) as {error?: {message?: string}; result?: R}
  if (reply.error) throw new Error(`chat api ${method}: ${reply.error.message ?? out}`)
  return reply.result as R
}

// topic name -> conversation id key, for every channel of the team
const teamChannels = async (actor: Actor, team: string) => {
  const res = await chatApi<{conversations?: Array<ConvSummary>}>(actor, 'listconvsonname', {
    members_type: 'team',
    name: team,
    topic_type: 'CHAT',
  })
  return new Map((res.conversations ?? []).map(c => [c.channel.topic_name ?? '', c.id]))
}

type ApiMessage = {
  msg?: {
    id: number
    conversation_id: string
    content: {type: string; text?: {body?: string}; attachment?: {object?: {title?: string}}}
    sender: {username?: string}
  }
}
type ReadResult = {messages?: Array<ApiMessage> | null; pagination?: {next?: string; last?: boolean}}

// The id of a one-on-one conversation (or the self one) by its tlf name, from its newest message;
// '' when it has none.
const directConvID = async (actor: Actor, tlfName: string) => {
  const res = await chatApi<ReadResult>(actor, 'read', {channel: {name: tlfName}, pagination: {num: 1}, peek: true})
  return res.messages?.[0]?.msg?.conversation_id ?? ''
}

// Every text message and attachment in a conversation, by id. Peeks, so reading marks nothing read.
const conversationMessages = async (actor: Actor, convID: string): Promise<Array<SweepCandidate>> => {
  const out: Array<SweepCandidate> = []
  let next: string | undefined
  for (;;) {
    const res = await chatApi<ReadResult>(actor, 'read', {
      conversation_id: convID,
      pagination: next ? {next, num: 500} : {num: 500},
      peek: true,
    })
    for (const {msg} of res.messages ?? []) {
      if (msg?.conversation_id !== convID) continue
      const {content} = msg
      const name = content.type === 'text' ? content.text?.body : content.type === 'attachment' ? content.attachment?.object?.title : undefined
      if (name === undefined) continue
      out.push({account: actor.account, convID, kind: 'message', messageID: msg.id, name, sender: msg.sender.username ?? ''})
    }
    if (!res.pagination?.next || res.pagination.last || !res.messages?.length) return out
    next = res.pagination.next
  }
}

type UserEmojiRes = {emojis?: {emojis?: Array<{name: string; emojis?: Array<{alias: string; isCrossTeam: boolean; teamname?: string | null}> | null}> | null}}

// Emoji the account can see, each with the team it belongs to (cross-team ones left out: they belong
// to another team than the group they show in).
const teamEmojis = async (actor: Actor): Promise<Array<SweepCandidate>> => {
  const res = await call<UserEmojiRes>(actor, 'chat.1.local.userEmojis', {
    convID: null,
    opts: {getAliases: true, getCreationInfo: false, onlyInTeam: false},
  })
  return (res.emojis?.emojis ?? []).flatMap(group =>
    (group.emojis ?? [])
      .filter(e => !e.isCrossTeam && (!e.teamname || e.teamname === group.name))
      .map(e => ({account: actor.account, kind: 'emoji' as const, name: listedEmojiAlias(e.alias), team: group.name}))
  )
}

type GitRepoResult = {
  state: number
  ok?: {folder: {folderType: number; name: string}; localMetadata: {repoName: string}}
}
const folderTypePrivate = 1
const folderTypeTeam = 3
const gitRepoOk = 1

const gitRepos = async (actor: Actor) =>
  ((await call<Array<GitRepoResult> | null>(actor, 'keybase.1.git.getAllGitMetadata', {})) ?? []).flatMap(r =>
    r.state === gitRepoOk && r.ok ? [r.ok] : []
  )

const personalRepos = async (actor: Actor) =>
  (await gitRepos(actor)).flatMap(r =>
    r.folder.folderType === folderTypePrivate && r.folder.name === actor.user ? [r.localMetadata.repoName] : []
  )

const teamRepos = async (actor: Actor): Promise<Array<SweepCandidate>> =>
  (await gitRepos(actor)).flatMap(r =>
    r.folder.folderType === folderTypeTeam
      ? [{account: actor.account, kind: 'teamRepo' as const, name: r.localMetadata.repoName, team: r.folder.name}]
      : []
  )

const emails = async (actor: Actor) =>
  (await call<Array<{email: string; isPrimary: boolean}> | null>(actor, 'keybase.1.emails.getEmails', {sessionID: 0})) ?? []

type Device = {deviceID: string; name: string; type: string}
const deviceList = async (actor: Actor) =>
  (await call<Array<Device> | null>(actor, 'keybase.1.device.deviceList', {sessionID: 0})) ?? []

// Paper keys are the `backup` devices.
const devices = async (actor: Actor): Promise<Array<SweepCandidate>> =>
  (await deviceList(actor)).map(d => ({
    account: actor.account,
    deviceID: d.deviceID,
    kind: d.type === 'backup' ? ('paperKey' as const) : ('device' as const),
    name: d.name,
  }))

const teamRoleOwner = 4
const ownedRootTeams = async (actor: Actor) => {
  const res = await call<{teams?: Array<{fqName: string; role: number}> | null}>(actor, 'keybase.1.teams.teamListUnverified', {
    includeImplicitTeams: false,
    sessionID: 0,
    userAssertion: actor.user,
  })
  return (res.teams ?? []).filter(t => t.role === teamRoleOwner && !t.fqName.includes('.')).map(t => t.fqName)
}

const subteams = async (actor: Actor, team: string) => {
  const res = await call<Array<{name: {parts: Array<string>}}> | null>(actor, 'keybase.1.teams.teamListSubteamsRecursive', {
    forceRepoll: false,
    parentTeamName: team,
    sessionID: 0,
  })
  return (res ?? []).map(t => t.name.parts.join('.'))
}

// `fs` expands globs in its arguments, so only plain paths go in.
const kbfsList = async (actor: Actor, dir: string) => {
  if (!/^\/keybase\/(?:private|public|team)\/[a-z0-9_.,]+(?:\/[A-Za-z0-9_.-]+)?$/.test(dir)) {
    throw new Error(`refusing to list ${dir}: not a plain KBFS folder path`)
  }
  return parseKbfsLs(await actor.cli(['fs', 'ls', '-w', '-a', '--nocolor', dir], kbfsTimeoutMs))
}

const kbfsEntries = async (actor: Actor, root: string, signal?: AbortSignal): Promise<Array<SweepCandidate>> => {
  const out: Array<SweepCandidate> = []
  for (const e of await kbfsList(actor, root)) {
    if (!e.name.startsWith('e2e-')) continue
    signal?.throwIfAborted()
    const name = `${root}/${e.name}`
    out.push(
      e.isDir
        ? {account: actor.account, dir: {empty: (await kbfsList(actor, name)).length === 0}, kind: 'kbfs', name}
        : {account: actor.account, kind: 'kbfs', name}
    )
  }
  return out
}

type Gathered = {candidates: Array<SweepCandidate>; convIDs: Map<string, string>; errors: Array<string>}

// Lists every kind, or only `kinds`.
const gather = async (actor: Actor, ctx: SweepContext, signal: AbortSignal | undefined, kinds?: ReadonlySet<SweepKind>): Promise<Gathered> => {
  const candidates: Array<SweepCandidate> = []
  const errors: Array<string> = []
  let convIDs = new Map<string, string>()
  const section = async (kind: SweepKind, what: string, f: () => Promise<Array<SweepCandidate>>) => {
    if (kinds && !kinds.has(kind)) return
    // outside the try: an abort stops the sweep rather than counting as a failed listing
    signal?.throwIfAborted()
    try {
      candidates.push(...(await f()))
    } catch (e) {
      errors.push(`${actor.account}: listing ${what} failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const {account} = actor
  if (account === 'smoke') {
    await section('channel', 'team channels', async () => {
      convIDs = await teamChannels(actor, ctx.team)
      return [...convIDs.keys()].map(name => ({account, kind: 'channel' as const, name}))
    })
    await section('subteam', 'subteams', async () => (await subteams(actor, ctx.team)).map(name => ({account, kind: 'subteam' as const, name})))
    await section('emoji', 'emoji', async () => teamEmojis(actor))
    await section('teamRepo', 'team git repos', async () => teamRepos(actor))
  }
  for (const [what, convID] of messageConvList(account, ctx)) {
    await section('message', `messages in ${what}`, async () => conversationMessages(actor, convID))
  }
  await section('repo', 'git repos', async () => (await personalRepos(actor)).map(name => ({account, kind: 'repo' as const, name})))
  await section('email', 'emails', async () =>
    (await emails(actor)).map(e => ({account, kind: 'email' as const, name: e.email, primary: e.isPrimary}))
  )
  await section('team', 'owned teams', async () => (await ownedRootTeams(actor)).map(name => ({account, kind: 'team' as const, name})))
  if (!kinds || kinds.has('device') || kinds.has('paperKey')) {
    signal?.throwIfAborted()
    try {
      candidates.push(...(await devices(actor)).filter(c => !kinds || kinds.has(c.kind)))
    } catch (e) {
      errors.push(`${account}: listing devices failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  // a KBFS that does not answer for one folder will not for the next either: fail those fast
  const kbfsDown: {root?: string} = {}
  for (const root of kbfsRoots(account, ctx)) {
    await section('kbfs', `KBFS ${root}`, async () => {
      if (kbfsDown.root) throw new Error(`KBFS did not answer for ${kbfsDown.root}`)
      try {
        return await kbfsEntries(actor, root, signal)
      } catch (e) {
        if (e instanceof Error && e.message.includes('no answer in')) kbfsDown.root = root
        throw e
      }
    })
  }
  return {candidates, convIDs, errors}
}

// The conversations whose messages an account sweeps, by what they are.
const messageConvList = (account: SweepAccount, ctx: SweepContext): Array<[string, string]> => {
  const {direct, scratch, self} = ctx.messageConvs
  const all: Array<[string, string]> = [
    ['the scratch channel', scratch],
    ['the smoke-second conversation', direct],
  ]
  if (account === 'smoke') all.push(['the self conversation', self])
  return all.filter(([, id]) => !!id)
}

// Exactly one listed device with this id, name and kind, or a refusal.
const requireListedDevice = async (actor: Actor, c: SweepCandidate) => {
  const listed = (await deviceList(actor)).filter(d => d.deviceID === c.deviceID)
  const [d] = listed
  if (!d) return undefined
  const kind = d.type === 'backup' ? 'paperKey' : 'device'
  if (listed.length !== 1 || d.name !== c.name || kind !== c.kind) {
    throw new Error(`refusing to revoke ${c.deviceID}: it is not exactly one ${c.kind} named as listed`)
  }
  return d
}

// The device ids nothing may revoke: the main service's own and this account's peer device.
const devicesInUse = async (actor: Actor) => {
  const status = JSON.parse(await runKeybase(['status', '-j'], {timeoutMs: 15_000})) as {Device?: {deviceID?: string}}
  const home = defaultPeerHome(actor.peerRole)
  // no peer home config: the id stays unknown, and checkRevocable refuses
  const peer = fs.existsSync(peerConfigPath(home)) ? (readPeerConfig(home).users?.[actor.user]?.device ?? '') : ''
  return {main: status.Device?.deviceID ?? '', peer}
}

const revokeListed = async (actor: Actor, c: SweepCandidate, env: E2EEnv) => {
  const deviceID = c.deviceID ?? ''
  const inUse = await devicesInUse(actor)
  checkRevocable(deviceID, inUse.peer, inUse.main)
  // the env file's paper key for this account is never revoked, whatever the ledger says
  checkNotProtectedPaperKey({deviceID, name: c.name}, protectedPaperKeyIn(await deviceList(actor), env.peers[actor.peerRole].paperKey))
  if (!(await requireListedDevice(actor, c))) return
  await actor.cli(['device', 'remove', deviceID], 120_000)
}


// Shuts the provisioned device's home down, revokes the device and removes the home; then revokes it
// directly if it is still listed (its home was already gone, or signed out).
const retireProvisioned = async (actor: Actor, c: SweepCandidate, env: E2EEnv) => {
  const run = parseStampedName(c.name, 'dashed')
  if (!run) throw new Error(`refusing to revoke ${c.name}: not a stamped device name`)
  const keep = defaultPeerHome(actor.peerRole)
  const say = (s: string) => console.log(maskAccounts(redactSecrets(s), {team: env.team, users: {second: env.secondUser, smoke: env.smokeUser}}))
  await retirePeerHome(
    {newHome: keep, oldHome: provisionHomeFor(run.runId), role: actor.peerRole, user: actor.user},
    {
      remove: async home => removeRetiredPeerHome(home, keep, env.smokeUser, say),
      revoke: async oldDevice => {
        if (oldDevice !== c.deviceID) throw new Error(`refusing to revoke ${oldDevice}: its home holds another device than ${c.name}`)
        await revokeListed(actor, c, env)
      },
      say,
      stop: stopPeerHomeService,
    }
  )
  const home = provisionHomeFor(run.runId)
  if (fs.existsSync(home)) throw new Error(`${home} is still there`)
  await revokeWithHomeStopped(home, {
    answers: async h => socketAnswers(socketPathFor(h)),
    pids: serviceProcessesFor,
    revoke: async () => revokeListed(actor, c, env),
    stop: stopPeerHomeService,
  })
}

const deleteOne = async (actor: Actor, c: SweepCandidate, convIDs: Map<string, string>, env: E2EEnv) => {
  switch (c.kind) {
    case 'channel': {
      const convID = convIDs.get(c.name)
      if (!convID) throw new Error('no conversation id listed for it')
      await call(actor, 'chat.1.local.deleteConversationLocal', {
        channelName: c.name,
        confirmed: true,
        convID: convIDBytes(convID),
        sessionID: 0,
      })
      return
    }
    case 'repo':
      await call(actor, 'keybase.1.git.deletePersonalRepo', {repoName: c.name})
      return
    case 'email':
      await call(actor, 'keybase.1.emails.deleteEmail', {email: c.name, sessionID: 0})
      return
    case 'kbfs':
      // no -r: a file, or a directory already checked empty
      await actor.cli(['fs', 'rm', c.name], kbfsTimeoutMs)
      return
    case 'subteam':
    case 'team':
      // the CLI asks on /dev/tty to type `nuke <the name it is deleting>`: answered with this name
      // only, so a name the service resolves differently is never confirmed
      await confirmedCli(actor, ['team', 'delete', c.name], 'please type:', `nuke ${c.name}`)
      return
    case 'message':
      await chatApi(actor, 'delete', {conversation_id: c.convID, message_id: c.messageID})
      return
    case 'emoji':
      // by the team's name: the service finds its general channel, and the emoji's storage, there
      await chatApi(actor, 'emojiremove', {alias: c.name, channel: {members_type: 'team', name: c.team, topic_name: 'general'}})
      return
    case 'teamRepo':
      // chat notifications off first, so the delete is announced nowhere
      await actor.cli(['git', 'settings', '--disable-chat', c.name, c.team ?? ''], 60_000)
      await call(actor, 'keybase.1.git.deleteTeamRepo', {notifyTeam: false, repoName: c.name, teamName: {parts: (c.team ?? '').split('.')}})
      return
    case 'device':
      await retireProvisioned(actor, c, env)
      return
    case 'paperKey':
      await revokeListed(actor, c, env)
      forgetPaperKey(c.deviceID ?? '')
      return
  }
}

// Runs the CLI under `expect` (a pseudo-terminal), which types `answer` and Enter once `prompt`
// appears. Exit code 2 means the prompt never came.
const confirmScript = [
  'set timeout 60',
  'spawn {*}$env(KB_CONFIRM_CMD)',
  'expect $env(KB_CONFIRM_PROMPT) { send "$env(KB_CONFIRM_ANSWER)\\r" } timeout { exit 2 }',
  'expect eof',
  'lassign [wait] pid spawnid oserr code',
  'exit $code',
].join('; ')

const confirmedCli = async (actor: Actor, args: Array<string>, prompt: string, answer: string) =>
  new Promise<void>((resolve, reject) => {
    const argv = [keybaseBin(), '--no-auto-fork', ...actor.cliFlags, ...args]
    if (argv.some(a => /[{}\\]/.test(a))) throw new Error(`refusing to run ${argv.join(' ')}: braces or backslashes`)
    const env = {...process.env, KB_CONFIRM_ANSWER: answer, KB_CONFIRM_CMD: argv.map(a => `{${a}}`).join(' '), KB_CONFIRM_PROMPT: prompt}
    const proc = spawn('expect', ['-c', confirmScript], {env})
    let output = ''
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error(`keybase ${args.join(' ')}: no answer in 90s: ${output}`))
    }, 90_000)
    proc.stdout.on('data', (d: Buffer) => (output += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (output += d.toString()))
    proc.on('error', e => {
      clearTimeout(timer)
      reject(new Error(`keybase ${args.join(' ')}: could not run expect: ${e.message}`))
    })
    proc.on('exit', code => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`keybase ${args.join(' ')} exited ${code}: ${output.trim()}`))
    })
  })

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const recheckMs = 10_000

// The deleted messages still shown, read back by id (a deleted message's id reads back as nothing),
// one call per conversation.
const messagesStillThere = async (actor: Actor, deleted: ReadonlyArray<SweepCandidate>) => {
  const byConv = new Map<string, Array<SweepCandidate>>()
  for (const c of deleted) byConv.set(c.convID ?? '', [...(byConv.get(c.convID ?? '') ?? []), c])
  const left: Array<SweepCandidate> = []
  const errors: Array<string> = []
  for (const [convID, msgs] of byConv) {
    try {
      const res = await chatApi<ReadResult>(actor, 'get', {conversation_id: convID, message_ids: msgs.map(c => c.messageID), peek: true})
      const shown = new Set(
        (res.messages ?? []).flatMap(({msg}) =>
          msg?.conversation_id === convID && (msg.content.type === 'text' || msg.content.type === 'attachment') ? [msg.id] : []
        )
      )
      left.push(...msgs.filter(c => shown.has(c.messageID ?? -1)))
    } catch (e) {
      errors.push(`${actor.account}: reading back deleted messages failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return {errors, left}
}

// A delete the service answered but did not carry out shows up as still listed. Listings can lag
// a delete, so this asks again for up to recheckMs before naming what is still there. Messages are
// read back by id; every other kind deleted is listed again.
const stillThere = async (actor: Actor, ctx: SweepContext, deleted: ReadonlyArray<SweepCandidate>, signal: AbortSignal | undefined) => {
  const deadline = Date.now() + recheckMs
  const messages = deleted.filter(c => c.kind === 'message')
  const others = deleted.filter(c => c.kind !== 'message')
  const keys = new Set(others.map(candidateKey))
  for (;;) {
    signal?.throwIfAborted()
    const msgs = messages.length ? await messagesStillThere(actor, messages) : {errors: [], left: []}
    const listed = others.length ? await gather(actor, ctx, signal, new Set(others.map(c => c.kind))) : {candidates: [], errors: []}
    const left = [...msgs.left, ...listed.candidates.filter(c => keys.has(candidateKey(c)))]
    const errors = [...msgs.errors, ...listed.errors]
    if ((!left.length && !errors.length) || Date.now() >= deadline) return {errors, left}
    await sleep(Math.min(2_000, Math.max(0, deadline - Date.now())))
  }
}

// The conversations messages are swept in, looked up on the main service by name. One that cannot
// be looked up is a listing error; one that does not exist yet is said out loud.
const messageConvs = async (main: Actor, env: E2EEnv, result: SweepResult): Promise<SweepContext['messageConvs']> => {
  const look = async (what: string, f: () => Promise<string>) => {
    try {
      const id = await f()
      if (!id) result.notes.push(`smoke: no ${what} yet, so no messages swept there`)
      return id
    } catch (e) {
      result.errors.push(`smoke: looking up ${what} failed: ${e instanceof Error ? e.message : String(e)}`)
      return ''
    }
  }
  return {
    direct: await look('smoke-second conversation', async () => directConvID(main, [env.smokeUser, env.secondUser].sort().join(','))),
    scratch: await look(`#${E2E_CHANNELS.scratch}`, async () => (await teamChannels(main, env.team)).get(E2E_CHANNELS.scratch) ?? ''),
    self: await look('self conversation', async () => directConvID(main, env.smokeUser)),
  }
}

// `runId` is the current run's KB_E2E_RUN_ID: its objects are never swept.
export const sweep = async (
  env: E2EEnv,
  opts: {before: number; dryRun: boolean; runId: string; signal?: AbortSignal}
): Promise<SweepResult> => {
  const {signal} = opts
  await requireMainIsSmoke(env)
  const result: SweepResult = {deleted: [], errors: [], kept: [], listOnly: [], notes: [], wouldDelete: []}
  const main = mainActor(env)
  const ctx: SweepContext = {
    before: opts.before,
    currentRunId: opts.runId,
    messageConvs: await messageConvs(main, env, result),
    paperKeys: readPaperKeys(),
    seededChannels: Object.values(E2E_CHANNELS),
    seededSubteams: [CLOSED_SUBTEAM],
    team: env.team,
    users: {second: env.secondUser, smoke: env.smokeUser},
  }
  const actors: Array<Actor> = [main]
  try {
    actors.push(await secondActor(env))
  } catch (e) {
    result.errors.push(`second: ${e instanceof Error ? e.message : String(e)}`)
  }

  for (const actor of actors) {
    if (!kbfsRoots(actor.account, ctx).length) result.notes.push(`${actor.account}: KBFS not swept (peer services run no KBFS)`)
    signal?.throwIfAborted()
    const {candidates, convIDs, errors} = await gather(actor, ctx, signal)
    result.errors.push(...errors)
    const sel = selectSweepTargets(candidates, ctx)
    result.kept.push(...sel.kept)
    result.listOnly.push(...sel.listOnly)
    result.wouldDelete.push(...sel.delete)
    if (opts.dryRun) continue
    // asked once for the batch's messages (many, each a small delete in a conversation of this
    // account's), and again right before every other delete
    const batchUser = sel.delete.some(c => c.kind === 'message') ? await actor.whoami() : ''
    for (const c of sel.delete) {
      signal?.throwIfAborted()
      try {
        checkDelete(c, ctx, c.kind === 'message' ? batchUser : await actor.whoami())
        await deleteOne(actor, c, convIDs, env)
        result.deleted.push(c)
      } catch (e) {
        result.errors.push(`${describeCandidate(c)}: delete failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    const deleted = result.deleted.filter(c => c.account === actor.account)
    if (!deleted.length) continue
    const after = await stillThere(actor, ctx, deleted, signal)
    result.errors.push(...after.errors.map(e => `re-checking deletes: ${e}`))
    for (const c of after.left) result.errors.push(`${describeCandidate(c)}: still there ${recheckMs / 1000}s after its delete`)
  }
  return result
}

export const formatSweep = (r: SweepResult, env: E2EEnv, dryRun: boolean) => {
  const mask = (s: string) => maskAccounts(redactSecrets(s), {team: env.team, users: {second: env.secondUser, smoke: env.smokeUser}})
  const lines: Array<string> = []
  const block = (title: string, rows: Array<string>) => {
    lines.push(`${title} (${rows.length})`)
    for (const row of rows) lines.push(`  ${mask(row)}`)
  }
  block(dryRun ? 'would delete' : 'deleted', (dryRun ? r.wouldDelete : r.deleted).map(describeCandidate))
  block('listed, not deleted', r.listOnly.map(n => `${describeCandidate(n.candidate)}: ${n.reason}`))
  // messages kept are many (seeded history, this run's): counted per account and reason
  const keptMessages = new Map<string, number>()
  for (const n of r.kept) {
    if (n.candidate.kind !== 'message') continue
    const k = `${n.candidate.account} messages: ${n.reason}`
    keptMessages.set(k, (keptMessages.get(k) ?? 0) + 1)
  }
  block('kept', [
    ...r.kept.filter(n => n.candidate.kind !== 'message').map(n => `${describeCandidate(n.candidate)}: ${n.reason}`),
    ...[...keptMessages].map(([k, n]) => `${n} ${k}`),
  ])
  block('not covered', r.notes)
  block('errors', r.errors)
  return lines.join('\n')
}

const main = async () => {
  const {values} = parseArgs({options: {'dry-run': {type: 'boolean'}}})
  const dryRun = values['dry-run'] === true
  const env = loadE2EEnv()
  const result = await sweep(env, {before: Date.now(), dryRun, runId: ensureRunId(process.env)})
  console.log(formatSweep(result, env, dryRun))
  return result.errors.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then(code => process.exit(code))
    .catch((e: unknown) => {
      console.error(redactSecrets(e instanceof Error ? e.message : String(e)))
      process.exit(1)
    })
}
