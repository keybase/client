// Peer services: extra `keybase --home <dir> service` processes signed in as the other test
// accounts, so the app under test (on the main service) has someone to talk to. Each peer has its
// own home, socket and log; nothing here touches the main service except `mainWhoami`.
//
// Every wait has a deadline. A peer that died or signed out fails the next call with
// "peer <role> at <home> is not running" / "is signed in as <x>" instead of hanging.
import {execFile, spawn} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type {E2EEnv, PeerRole} from '../accounts/env.ts'
import {keybaseBin} from './keybase-bin.ts'
import {connectPeerRpc, type PeerRpc} from './peer-rpc.ts'

export type Peer = {
  role: PeerRole
  home: string
  user: string
  cli: (args: string[], timeoutMs?: number) => Promise<string>
  chatApi: (msg: object) => Promise<unknown>
  rpc: () => Promise<PeerRpc>
}

export const socketPathFor = (home: string) => path.join(home, 'Library', 'Caches', 'Keybase', 'keybased.sock')
export const mainSocketPath = () => socketPathFor(os.homedir())
export const peerLogPath = (home: string) => path.join(home, 'service.log')
export const peerConfigPath = (home: string) => path.join(home, 'Library', 'Application Support', 'Keybase', 'config.json')

// libkb's GetForceSecretStoreFile config key: keep the device secret in a file in the home's data
// dir instead of the Keychain (see startPeerService for why peers must).
export const fileSecretStoreKey = 'force_less_safe_secret_store_file'

export const peerUsesFileSecretStore = (home: string) => {
  try {
    const cfg = JSON.parse(fs.readFileSync(peerConfigPath(home), 'utf8')) as Record<string, unknown>
    return cfg[fileSecretStoreKey] === true
  } catch {
    return false
  }
}

// Sets the key in a peer home's config, creating it for a fresh home. Only while the home's
// service is stopped: a running service rewrites the file from memory. Never the main service's.
export const setPeerFileSecretStore = (home: string) => {
  if (path.resolve(home) === path.resolve(os.homedir())) throw new Error('refusing to edit the main service config')
  const file = peerConfigPath(home)
  const cfg = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>) : {}
  if (cfg[fileSecretStoreKey] === true) return
  cfg[fileSecretStoreKey] = true
  fs.mkdirSync(path.dirname(file), {mode: 0o700, recursive: true})
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 4), {mode: 0o600})
  fs.renameSync(tmp, file)
}

export const fileSecretStoreProblem = (role: PeerRole, home: string) =>
  `peer ${role} at ${home} does not keep its secret in a file: ${peerConfigPath(home)} lacks ${fileSecretStoreKey} (run yarn test:e2e:accounts:setup)`

// Paper keys are runs of lowercase words; never let one reach output or an error message.
export const redactSecrets = (s: string) => s.replace(/[a-z]+(?: [a-z]+){9,}/g, '<redacted>')

// The device names a peer may provision as. Keybase never lets an account reuse a device name,
// even a revoked one, so a peer reprovisioned after its home was lost takes the next suffix.
export const deviceNameCandidates = (role: PeerRole) => [
  `e2e-${role}-svc`,
  ...Array.from({length: 19}, (_, i) => `e2e-${role}-svc-${i + 2}`),
]

// One CLI call with stdin closed (or fed `input`, never argv, so secrets stay out of `ps`), a
// deadline, and stderr folded into the error.
export const runKeybase = async (
  args: ReadonlyArray<string>,
  opts: {timeoutMs?: number; input?: string} = {}
): Promise<string> => {
  const timeoutMs = opts.timeoutMs ?? 30_000
  const shown = redactSecrets(`keybase ${args.join(' ')}`)
  return new Promise<string>((resolve, reject) => {
    const proc = execFile(
      keybaseBin(),
      ['--no-auto-fork', ...args],
      {encoding: 'utf8', killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs},
      (err, stdout, stderr) => {
        if (err?.killed) reject(new Error(`${shown}: no answer in ${timeoutMs / 1000}s`))
        else if (err) reject(new Error(`${shown}: ${redactSecrets((stderr || stdout || err.message).trim())}`))
        else resolve(stdout.trim())
      }
    )
    proc.stdin?.end(opts.input ?? '')
  })
}

// runKeybase in a session of its own (setsid), outside the terminal's process group, so a Ctrl-C
// meant for this process never reaches the CLI. execFile cannot do that: it drops `detached`.
export const runKeybaseDetached = async (args: ReadonlyArray<string>, opts: {timeoutMs?: number} = {}): Promise<string> => {
  const timeoutMs = opts.timeoutMs ?? 30_000
  const shown = redactSecrets(`keybase ${args.join(' ')}`)
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(keybaseBin(), ['--no-auto-fork', ...args], {detached: true, stdio: ['ignore', 'pipe', 'pipe']})
    let stdout = ''
    let stderr = ''
    let timedOut = false
    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
    }, timeoutMs)
    proc.on('error', e => {
      clearTimeout(timer)
      reject(new Error(`${shown}: ${e.message}`))
    })
    proc.on('close', code => {
      clearTimeout(timer)
      if (timedOut) reject(new Error(`${shown}: no answer in ${timeoutMs / 1000}s`))
      else if (code !== 0) reject(new Error(`${shown}: ${redactSecrets((stderr || stdout || `exited ${code}`).trim())}`))
      else resolve(stdout.trim())
    })
  })
}

export const mainWhoami = async () => runKeybase(['whoami'], {timeoutMs: 15_000})

export const requireMainIsSmoke = async (env: Pick<E2EEnv, 'smokeUser'>) => {
  const who = await mainWhoami().catch((e: unknown) => {
    throw new Error(`the main keybase service does not answer whoami: ${String(e)}`)
  })
  if (who !== env.smokeUser) {
    throw new Error(`the main keybase service is signed in as ${who || 'nobody'}, not the e2e smoke account; refusing to run`)
  }
}

// Whether a service answers on `socket`: it accepts the connection and returns its status.
export const socketAnswers = async (socket: string) => {
  let rpc: PeerRpc | undefined
  try {
    rpc = await connectPeerRpc(socket, 2_000)
    await rpc.call('keybase.1.config.getCurrentStatus', {sessionID: 0}, 5_000)
    return true
  } catch {
    return false
  } finally {
    rpc?.close()
  }
}

// The macOS Keychain entry for a user's device secret is keyed by username alone, shared by every
// home on the machine: a peer storing its secret there overwrites the main service's for the same
// account (owner is the smoke account), and a peer device's revoke clears it. Peers keep theirs in
// a file in their own home instead.
export const startPeerService = (home: string) => {
  const child = spawn(keybaseBin(), ['--home', home, '-d', `--log-file=${peerLogPath(home)}`, 'service'], {
    detached: true,
    env: {...process.env, KEYBASE_SECRET_STORE_FILE: '1'},
    stdio: 'ignore',
  })
  child.unref()
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export type PeerDeps = {
  cli?: (args: string[], timeoutMs?: number) => Promise<string>
  answers?: (socket: string) => Promise<boolean>
  start?: (home: string) => void
  startDeadlineMs?: number
  pollMs?: number
}

export const peerCli = (home: string) => async (args: string[], timeoutMs?: number) =>
  runKeybase(['--home', home, ...args], {timeoutMs})

// Waits for `home`'s service to answer, starting it first if it does not. Throws naming the home.
export const waitForPeerService = async (role: PeerRole, home: string, deps: PeerDeps = {}) => {
  const answers = deps.answers ?? socketAnswers
  const socket = socketPathFor(home)
  if (await answers(socket)) return
  ;(deps.start ?? startPeerService)(home)
  const deadlineMs = deps.startDeadlineMs ?? 30_000
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    await sleep(Math.min(deps.pollMs ?? 500, Math.max(0, deadline - Date.now())))
    if (await answers(socket)) return
  }
  throw new Error(
    `peer ${role} at ${home} is not running: no answer on ${socket} within ${deadlineMs / 1000}s of starting it (log: ${peerLogPath(home)})`
  )
}

export const ensurePeer = async (role: PeerRole, env: E2EEnv, deps: PeerDeps = {}): Promise<Peer> => {
  const {home, user} = env.peers[role]
  const rawCli = deps.cli ?? peerCli(home)
  const answers = deps.answers ?? socketAnswers
  const socket = socketPathFor(home)

  const whoami = async () => rawCli(['whoami'], 15_000).catch(() => '')
  const checkSignedIn = async () => {
    const who = await whoami()
    if (who !== user) throw new Error(`peer ${role} at ${home} is signed in as ${who || 'nobody'}, expected ${user}`)
  }

  // After a failure, say what is wrong with the peer rather than echoing the bare CLI error.
  const diagnose = async (e: unknown): Promise<never> => {
    const why = e instanceof Error ? e.message : String(e)
    if (!(await answers(socket))) throw new Error(`peer ${role} at ${home} is not running (${why})`)
    await checkSignedIn()
    throw e
  }

  // A peer on the Keychain would overwrite the main service's stored secret for the same account.
  if (!peerUsesFileSecretStore(home)) throw new Error(fileSecretStoreProblem(role, home))
  await waitForPeerService(role, home, deps)
  await checkSignedIn()

  const cli = async (args: string[], timeoutMs?: number) => rawCli(args, timeoutMs).catch(diagnose)
  return {
    chatApi: async (msg: object) => {
      const out = await cli(['chat', 'api', '-m', JSON.stringify(msg)], 60_000)
      const reply = JSON.parse(out) as {error?: {message?: string}; result?: unknown}
      if (reply.error) throw new Error(`peer ${role} chat api ${JSON.stringify(msg)}: ${reply.error.message ?? out}`)
      return reply.result
    },
    cli,
    home,
    role,
    rpc: async () => connectPeerRpc(socket).catch(diagnose),
    user,
  }
}
