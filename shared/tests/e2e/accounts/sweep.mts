// yarn test:e2e:accounts:sweep [--dry-run]
//
// Removes what earlier e2e runs left behind in the test accounts (see sweep-lib.ts for which names
// qualify). The smoke account acts through the main service, which must be signed in as it; the
// second account through its peer service. For each account it lists:
//   team channels of KB_E2E_TEAM (smoke only: deleting one needs a team admin), personal git
//   repos, emails, subteams of KB_E2E_TEAM (smoke only), root teams it owns, devices, and (smoke
//   only: peer services run no KBFS) KBFS entries directly in its private folder and the team's.
// Devices are only listed; paper keys are left out, since nothing about one shows a run made it.
// Each delete first re-checks the acting account and the name, targets one exact object and never
// recurses: a KBFS directory goes only when empty, a team only once its subteams are gone. Exits 1
// when a listing or a delete failed. An aborted sweep (sweep's `signal`) stops between listings and
// deletes, rejecting with the signal's reason.
import {spawn} from 'child_process'
import {pathToFileURL} from 'url'
import {parseArgs} from 'util'
import {loadE2EEnv, type E2EEnv} from './env.ts'
import {
  checkDelete,
  describeCandidate,
  kbfsRoots,
  maskAccounts,
  parseKbfsLs,
  selectSweepTargets,
  type SweepAccount,
  type SweepCandidate,
  type SweepKind,
  type SweepContext,
  type SweepNote,
} from './sweep-lib.ts'
import {ensureRunId} from './run-id.ts'
import {CLOSED_SUBTEAM, E2E_CHANNELS} from '../shared/chat-data.ts'
import {convIDBytes} from '../shared/conv-id.ts'
import {keybaseBin} from '../shared/keybase-bin.ts'
import {connectPeerRpc, type PeerRpc} from '../shared/peer-rpc.ts'
import {
  ensurePeer,
  mainSocketPath,
  mainWhoami,
  redactSecrets,
  requireMainIsSmoke,
  runKeybase,
} from '../shared/peer-service.ts'

type Actor = {
  account: SweepAccount
  user: string
  // global flags that point the CLI at this account's service
  cliFlags: Array<string>
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
    rpc: peer.rpc,
    user: peer.user,
    whoami: async () => peer.cli(['whoami'], 15_000).catch(() => ''),
  }
}

type ConvSummary = {id: string; channel: {topic_name?: string}}

// topic name -> conversation id key, for every channel of the team
const teamChannels = async (actor: Actor, team: string) => {
  const msg = {method: 'listconvsonname', params: {options: {members_type: 'team', name: team, topic_type: 'CHAT'}}}
  const out = await actor.cli(['chat', 'api', '-m', JSON.stringify(msg)], 60_000)
  const reply = JSON.parse(out) as {error?: {message?: string}; result?: {conversations?: Array<ConvSummary>}}
  if (reply.error) throw new Error(`listconvsonname: ${reply.error.message ?? out}`)
  return new Map((reply.result?.conversations ?? []).map(c => [c.channel.topic_name ?? '', c.id]))
}

type GitRepoResult = {
  state: number
  ok?: {folder: {folderType: number; name: string}; localMetadata: {repoName: string}}
}
const folderTypePrivate = 1
const gitRepoOk = 1

const personalRepos = async (actor: Actor) => {
  const res = (await call<Array<GitRepoResult> | null>(actor, 'keybase.1.git.getAllGitMetadata', {})) ?? []
  return res.flatMap(r =>
    r.state === gitRepoOk && r.ok?.folder.folderType === folderTypePrivate && r.ok.folder.name === actor.user
      ? [r.ok.localMetadata.repoName]
      : []
  )
}

const emails = async (actor: Actor) =>
  (await call<Array<{email: string; isPrimary: boolean}> | null>(actor, 'keybase.1.emails.getEmails', {sessionID: 0})) ?? []

const devices = async (actor: Actor) =>
  ((await call<Array<{name: string; type: string}> | null>(actor, 'keybase.1.device.deviceList', {sessionID: 0})) ?? [])
    .filter(d => d.type !== 'backup')
    .map(d => d.name)

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
  if (!/^\/keybase\/(?:private|team)\/[a-z0-9_.]+(?:\/[A-Za-z0-9_.-]+)?$/.test(dir)) {
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
  }
  await section('repo', 'git repos', async () => (await personalRepos(actor)).map(name => ({account, kind: 'repo' as const, name})))
  await section('email', 'emails', async () =>
    (await emails(actor)).map(e => ({account, kind: 'email' as const, name: e.email, primary: e.isPrimary}))
  )
  await section('team', 'owned teams', async () => (await ownedRootTeams(actor)).map(name => ({account, kind: 'team' as const, name})))
  await section('device', 'devices', async () => (await devices(actor)).map(name => ({account, kind: 'device' as const, name})))
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

const deleteOne = async (actor: Actor, c: SweepCandidate, convIDs: Map<string, string>) => {
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
    case 'device':
      throw new Error('devices are never revoked by the sweeper')
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

// A delete the service answered but did not carry out shows up as still listed. Listings can lag
// a delete, so this asks again for up to recheckMs before naming what is still there.
const stillThere = async (actor: Actor, ctx: SweepContext, deleted: ReadonlyArray<SweepCandidate>, signal: AbortSignal | undefined) => {
  const deadline = Date.now() + recheckMs
  for (;;) {
    const after = await gather(actor, ctx, signal, new Set(deleted.map(c => c.kind)))
    const left = after.candidates.filter(c => deleted.some(d => d.kind === c.kind && d.name === c.name))
    if ((!left.length && !after.errors.length) || Date.now() >= deadline) return {errors: after.errors, left}
    await sleep(Math.min(2_000, Math.max(0, deadline - Date.now())))
  }
}

// `runId` is the current run's KB_E2E_RUN_ID: its objects are never swept.
export const sweep = async (
  env: E2EEnv,
  opts: {before: number; dryRun: boolean; runId: string; signal?: AbortSignal}
): Promise<SweepResult> => {
  const {signal} = opts
  await requireMainIsSmoke(env)
  const ctx: SweepContext = {
    before: opts.before,
    currentRunId: opts.runId,
    seededChannels: Object.values(E2E_CHANNELS),
    seededSubteams: [CLOSED_SUBTEAM],
    team: env.team,
    users: {second: env.secondUser, smoke: env.smokeUser},
  }
  const result: SweepResult = {deleted: [], errors: [], kept: [], listOnly: [], notes: [], wouldDelete: []}
  const actors: Array<Actor> = [mainActor(env)]
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
    for (const c of sel.delete) {
      signal?.throwIfAborted()
      try {
        checkDelete(c, ctx, await actor.whoami())
        await deleteOne(actor, c, convIDs)
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
  block('kept', r.kept.map(n => `${describeCandidate(n.candidate)}: ${n.reason}`))
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
