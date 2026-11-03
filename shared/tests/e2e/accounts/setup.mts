// yarn test:e2e:accounts:setup [--check]
//
// Gives each peer role (see env.ts) its own signed-in `keybase --home` service under
// ~/.config/keybase-e2e/homes/<role>, recording its home and paper key in the env file:
//   1. a role with no paper key gets one, made on the main service (for `second` the main service
//      is switched to that account for the call and always switched back; `owner` needs no switch)
//   2. the role's home is provisioned with it as a new device, e2e-<role>-svc[-N]
//   3. the main service refreshes the account (`keybase id`): until it does, it rejects the new
//      device's messages as "sender key not found"
//   4. the peer sends e2e-<runid>-setup (to the main<->second DM, or the team scratch channel for
//      `owner`) and the main service must read it decrypted within 20s
//   5. a home recorded somewhere else is retired: its service shut down, its device revoked, and
//      the directory removed. Only `ctl stop --shutdown`: plain `ctl stop` on macOS also quits
//      every Keybase app on the machine, including a simulator's
// Paper keys only ever travel through stdin and the env file; anything echoed is redacted.
//
// --check changes nothing: it exits 1 listing what setup would have to do.
import * as fs from 'fs'
import * as path from 'path'
import {parseArgs} from 'util'
import {
  defaultEnvPath,
  defaultPeerHome,
  e2eConfigDir,
  homeVar,
  paperKeyVar,
  peerRoles,
  readEnvFile,
  setEnvVars,
  type E2EEnv,
  type PeerRole,
} from './env.ts'
import {checkRetirablePeerHome, checkRevocable, restoreMainAccount, retirePeerHome, withSignalsDeferred} from './peer-homes.ts'
import {ensureRunId} from './run-id.ts'
import {E2E_CHANNELS} from '../shared/chat-data.ts'
import {keybaseBin} from '../shared/keybase-bin.ts'
import {connectPeerRpc} from '../shared/peer-rpc.ts'
import {
  deviceNameCandidates,
  ensurePeer,
  fileSecretStoreProblem,
  mainSocketPath,
  mainWhoami,
  peerUsesFileSecretStore,
  redactSecrets,
  requireMainIsSmoke,
  runKeybase,
  runKeybaseDetached,
  setPeerFileSecretStore,
  socketAnswers,
  socketPathFor,
  waitForPeerService,
  type Peer,
} from '../shared/peer-service.ts'

const say = (s: string) => console.log(redactSecrets(s))
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const paperKeyRe = /^[a-z]+(?: [a-z]+){9,}$/

const envFile = defaultEnvPath()

type Vars = Record<string, string>
const loadVars = (): Vars => {
  const vars: Vars = {...readEnvFile(envFile)}
  for (const k of ['KB_SMOKE_USER', 'KB_SECOND_USER', 'KB_E2E_TEAM']) {
    const v = process.env[k]
    if (v) vars[k] = v
  }
  const missing = ['KB_SMOKE_USER', 'KB_SECOND_USER', 'KB_E2E_TEAM'].filter(k => !vars[k])
  if (missing.length) throw new Error(`${envFile} is missing ${missing.join(', ')}; setup never picks accounts itself`)
  return vars
}

const userFor = (role: PeerRole, vars: Vars) => (role === 'owner' ? vars['KB_SMOKE_USER'] : vars['KB_SECOND_USER']) ?? ''

const envFor = (vars: Vars, role: PeerRole, home: string, paperKey: string): E2EEnv => {
  const smokeUser = vars['KB_SMOKE_USER'] ?? ''
  const secondUser = vars['KB_SECOND_USER'] ?? ''
  const other: PeerRole = role === 'owner' ? 'second' : 'owner'
  return {
    peers: {
      [role]: {home, paperKey, user: userFor(role, vars)},
      [other]: {home: defaultPeerHome(other), paperKey: '', user: userFor(other, vars)},
    } as E2EEnv['peers'],
    secondUser,
    smokeUser,
    team: vars['KB_E2E_TEAM'] ?? '',
  }
}

const mainChatApi = async (msg: object, timeoutMs = 60_000): Promise<unknown> => {
  const out = await runKeybase(['chat', 'api', '-m', JSON.stringify(msg)], {timeoutMs})
  const reply = JSON.parse(out) as {error?: {message?: string}; result?: unknown}
  if (reply.error) throw new Error(`main chat api ${JSON.stringify(msg)}: ${reply.error.message ?? out}`)
  return reply.result
}

const peerWhoami = async (home: string) => runKeybase(['--home', home, 'whoami'], {timeoutMs: 15_000}).catch(() => '')

// What setup still has to do for `role`; empty when the peer is ready.
const problemsFor = async (role: PeerRole, vars: Vars): Promise<string[]> => {
  const target = defaultPeerHome(role)
  const user = userFor(role, vars)
  const problems: string[] = []
  if (!vars[paperKeyVar(role)]) problems.push(`${paperKeyVar(role)} is not set`)
  if (vars[homeVar(role)] !== target) problems.push(`${homeVar(role)} is ${vars[homeVar(role)] ?? 'unset'}, not ${target}`)
  if (!peerUsesFileSecretStore(target)) problems.push(fileSecretStoreProblem(role, target))
  if (!(await socketAnswers(socketPathFor(target)))) {
    problems.push(`peer ${role} at ${target} is not running`)
  } else {
    const who = await peerWhoami(target)
    if (who !== user) problems.push(`peer ${role} at ${target} is signed in as ${who || 'nobody'}`)
  }
  return problems
}

// Detached: the terminal's Ctrl-C must not kill a switch half done (withSignalsDeferred holds it
// for this process instead).
const runSwitch = async (user: string) => runKeybaseDetached(['login', '--switch', user], {timeoutMs: 60_000})

const switchMain = async (user: string) => {
  if ((await mainWhoami().catch(() => '')) === user) return
  await runSwitch(user)
  const now = await mainWhoami().catch(() => '')
  if (now !== user) throw new Error(`the main service is ${now || 'signed out'} after switching to ${user}`)
}

// Back to the smoke account, retried, never returning until whoami says so or the tries run out.
const restoreMain = async (smoke: string) =>
  restoreMainAccount(
    smoke,
    `set -a; source ${envFile}; set +a; ${keybaseBin()} login --switch "$KB_SMOKE_USER"`,
    {
      say,
      switchTo: async user => {
        await runSwitch(user)
      },
      whoami: async () => mainWhoami().catch(() => ''),
    }
  )

// A new paper key for whoever the main service is signed in as. Done over the service's socket so
// the existing paper-key prompts ("also revoke ...?") are answered no by code, never a terminal.
const makePaperKey = async (): Promise<string> => {
  let phrase = ''
  const rpc = await connectPeerRpc(mainSocketPath(), 10_000, (method, arg) => {
    switch (method) {
      case 'keybase.1.loginUi.promptRevokePaperKeys':
        return false
      case 'keybase.1.loginUi.displayPaperKeyPhrase':
        phrase = (arg as {phrase?: string} | undefined)?.phrase ?? ''
        return null
      case 'keybase.1.logUi.log':
        return null
      default:
        throw new Error(`e2e setup does not answer ${method}`)
    }
  })
  try {
    await rpc.call('keybase.1.login.paperKey', {sessionID: 1}, 120_000)
  } finally {
    rpc.close()
  }
  if (!paperKeyRe.test(phrase)) throw new Error('the main service made a paper key but sent no usable phrase')
  return phrase
}

const ensurePaperKey = async (role: PeerRole, vars: Vars) => {
  const existing = vars[paperKeyVar(role)]
  if (existing) return existing
  const smoke = vars['KB_SMOKE_USER'] ?? ''
  let key: string
  if (role === 'owner') {
    await requireMainIsSmoke({smokeUser: smoke})
    key = await makePaperKey()
  } else {
    key = await withSignalsDeferred(
      async () => {
        await switchMain(userFor(role, vars))
        return makePaperKey()
      },
      async () => {
        await restoreMain(smoke)
        await requireMainIsSmoke({smokeUser: smoke})
      },
      {say}
    )
  }
  setEnvVars(envFile, {[paperKeyVar(role)]: key})
  vars[paperKeyVar(role)] = key
  say(`${role}: made a paper key and saved it to ${envFile}`)
  return key
}

// Signs `home`'s service in as `user` with the paper key, as the first free e2e-<role>-svc name.
const provisionHome = async (role: PeerRole, home: string, user: string, paperKey: string) => {
  fs.mkdirSync(home, {mode: 0o700, recursive: true})
  if (!peerUsesFileSecretStore(home)) {
    if (await socketAnswers(socketPathFor(home))) {
      throw new Error(`${fileSecretStoreProblem(role, home)}; stop its service (ctl stop --shutdown) and rerun`)
    }
    setPeerFileSecretStore(home)
  }
  await waitForPeerService(role, home)
  const who = await peerWhoami(home)
  if (who === user) return
  if (who) throw new Error(`peer ${role} at ${home} is signed in as ${who}; not touching it`)
  for (const name of deviceNameCandidates(role)) {
    try {
      await runKeybase(['--home', home, 'login', '--devicename', name, user], {
        input: `${paperKey}\n`,
        timeoutMs: 180_000,
      })
      say(`${role}: provisioned ${home} as device ${name}`)
      return
    } catch (e) {
      if (/device name already in use/i.test(String(e))) {
        say(`${role}: device name ${name} is taken, trying the next`)
        continue
      }
      throw e
    }
  }
  throw new Error(`${role}: every e2e-${role}-svc device name is taken`)
}

type Status = {Device?: {name?: string; deviceID?: string}}
const deviceOf = async (cli: (args: string[]) => Promise<string>) => {
  const s = JSON.parse(await cli(['status', '-j'])) as Status
  return {id: s.Device?.deviceID ?? '', name: s.Device?.name ?? ''}
}

type ReadMessage = {
  msg?: {content?: {type?: string; text?: {body?: string}}; sender?: {username?: string; device_name?: string}}
  error?: string
}

// The peer sends a marker; the main service has to read it decrypted, from the peer's device.
const proveRoundTrip = async (peer: Peer, vars: Vars, runId: string) => {
  const smoke = vars['KB_SMOKE_USER'] ?? ''
  const channel =
    peer.role === 'owner'
      ? {members_type: 'team', name: vars['KB_E2E_TEAM'] ?? '', topic_name: E2E_CHANNELS.scratch}
      : {name: `${smoke},${peer.user}`}
  const body = `e2e-${runId}-setup`
  const device = await deviceOf(async args => peer.cli(args))
  await peer.chatApi({method: 'send', params: {options: {channel, message: {body}}}})
  const deadline = Date.now() + 20_000
  let errors: string[] = []
  while (Date.now() < deadline) {
    const res = (await mainChatApi(
      {method: 'read', params: {options: {channel, pagination: {num: 20}}}},
      Math.max(1_000, deadline - Date.now())
    )) as {messages?: ReadMessage[]}
    const messages = res.messages ?? []
    const hit = messages.find(m => m.msg?.content?.text?.body === body)
    if (hit) {
      const from = hit.msg?.sender
      if (from?.username !== peer.user || from.device_name !== device.name) {
        throw new Error(`${body} arrived from ${from?.username}/${from?.device_name}, not ${peer.user}/${device.name}`)
      }
      say(`${peer.role}: main service read ${body} from device ${device.name}`)
      return
    }
    errors = messages.flatMap(m => (m.error ? [m.error] : []))
    await sleep(Math.min(1_000, Math.max(0, deadline - Date.now())))
  }
  throw new Error(
    `${peer.role}: the main service did not read ${body} within 20s${errors.length ? ` (unreadable rows: ${errors.join('; ')})` : ''}`
  )
}

// Removes a retired peer home, re-checking everything right before the delete.
const guardedRemoveHome = async (dir: string, keep: string, vars: Vars) => {
  await requireMainIsSmoke({smokeUser: vars['KB_SMOKE_USER'] ?? ''})
  const abs = checkRetirablePeerHome(dir, keep)
  if (await socketAnswers(socketPathFor(abs))) throw new Error(`refusing to remove ${dir}: its service still answers`)
  fs.rmSync(abs, {recursive: true})
  say(`removed ${abs}`)
}

const waitUntil = async (what: string, ms: number, check: () => Promise<boolean> | boolean) => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await check()) return
    await sleep(500)
  }
  throw new Error(`timed out after ${ms / 1000}s waiting for ${what}`)
}

const pidAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const revokeDevice = async (peer: Peer, oldHome: string, oldDevice: string) => {
  const current = await deviceOf(async args => peer.cli(args))
  const main = await deviceOf(async args => runKeybase(args, {timeoutMs: 15_000}))
  checkRevocable(oldDevice, current.id, main.id)
  const rpc = await peer.rpc()
  let devices: Array<{name: string; deviceID: string; type: string}>
  try {
    devices = await rpc.call('keybase.1.device.deviceList', {sessionID: 0})
  } finally {
    rpc.close()
  }
  const target = devices.filter(d => d.deviceID === oldDevice)
  const namePattern = new RegExp(`^e2e-${peer.role}-svc(?:-\\d+)?$`)
  const [device] = target
  if (!device) {
    say(`${peer.role}: device ${oldDevice} of ${oldHome} is already revoked`)
    return
  }
  if (target.length !== 1 || !namePattern.test(device.name) || device.type !== 'desktop') {
    throw new Error(`refusing to revoke ${oldDevice}: it is not exactly one e2e-${peer.role}-svc desktop device`)
  }
  await peer.cli(['device', 'remove', oldDevice], 120_000)
  say(`${peer.role}: revoked device ${device.name} (${oldDevice}) of ${oldHome}`)
}

// Shuts an older home's service down and waits for it to exit (pid read first: a clean shutdown
// removes the pid file). Only ever called on a path checkRetirablePeerHome accepted.
const stopRetiredService = async (home: string) => {
  const socket = socketPathFor(home)
  const pidFile = path.join(home, 'Library', 'Caches', 'Keybase', 'keybased.pid')
  const pid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8').trim()) : NaN
  if (await socketAnswers(socket)) await runKeybase(['--home', home, 'ctl', 'stop', '--shutdown'], {timeoutMs: 30_000})
  await waitUntil(`the service in ${home} to exit`, 20_000, async () => {
    if (await socketAnswers(socket)) return false
    return !Number.isInteger(pid) || pid <= 0 || !pidAlive(pid)
  })
}

const retireOldHome = async (peer: Peer, oldHome: string, vars: Vars) =>
  retirePeerHome(
    {newHome: peer.home, oldHome, role: peer.role, user: peer.user},
    {
      remove: async home => guardedRemoveHome(home, peer.home, vars),
      revoke: async oldDevice => revokeDevice(peer, oldHome, oldDevice),
      say,
      stop: stopRetiredService,
    }
  )

const setUpRole = async (role: PeerRole, vars: Vars, runId: string) => {
  const target = defaultPeerHome(role)
  const user = userFor(role, vars)
  const recorded = vars[homeVar(role)]
  const paperKey = await ensurePaperKey(role, vars)
  await provisionHome(role, target, user, paperKey)
  await runKeybase(['id', user], {timeoutMs: 60_000})
  const peer = await ensurePeer(role, envFor(vars, role, target, paperKey))
  await proveRoundTrip(peer, vars, `${runId}-${role}`)
  // The old home stays recorded until it is retired, so an interrupted run picks it up again.
  if (recorded && recorded !== target) await retireOldHome(peer, recorded, vars)
  if (recorded !== target) {
    setEnvVars(envFile, {[homeVar(role)]: target})
    vars[homeVar(role)] = target
    say(`${role}: ${homeVar(role)} is now ${target}`)
  }
}

const run = async () => {
  const {values} = parseArgs({options: {check: {type: 'boolean'}}})
  const vars = loadVars()
  const smoke = vars['KB_SMOKE_USER'] ?? ''
  await requireMainIsSmoke({smokeUser: smoke})

  if (values.check) {
    const problems = (await Promise.all(peerRoles.map(async r => problemsFor(r, vars)))).flat()
    if (problems.length) {
      say(`e2e peers are not ready:\n  ${problems.join('\n  ')}\nrun: yarn test:e2e:accounts:setup`)
      return 1
    }
    say('e2e peers are ready')
    return 0
  }

  fs.mkdirSync(path.join(e2eConfigDir(), 'homes'), {mode: 0o700, recursive: true})
  const runId = ensureRunId(process.env)
  try {
    for (const role of peerRoles) {
      const problems = await problemsFor(role, vars)
      if (!problems.length) {
        say(`${role}: ready`)
        continue
      }
      say(`${role}: ${problems.join('; ')}`)
      await setUpRole(role, vars, runId)
    }
  } finally {
    await restoreMain(smoke)
    await requireMainIsSmoke({smokeUser: smoke})
  }
  say('e2e peers are ready')
  return 0
}

run()
  .then(code => process.exit(code))
  .catch((e: unknown) => {
    console.error(redactSecrets(e instanceof Error ? e.message : String(e)))
    process.exit(1)
  })
