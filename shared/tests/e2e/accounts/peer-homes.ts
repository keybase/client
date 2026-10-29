// The safety rails setup uses around peer homes and the main service: which directories may be
// retired, which devices may be revoked, and keeping main's account switch from being cut short.
import {execFileSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {e2eConfigDir, type PeerRole} from './env.ts'
import {peerConfigPath, requireMainIsSmoke, runKeybase, socketAnswers, socketPathFor} from '../shared/peer-service.ts'

export const peerHomeRoots = () => [path.join(e2eConfigDir(), 'homes') + path.sep]

const realPath = (p: string) => {
  try {
    return fs.realpathSync(p)
  } catch {
    return undefined
  }
}

// Throws unless `dir` is an e2e peer home that may be shut down and removed: absolute and already
// normalised, its own real path (no symlink in it, so the recursive delete stays where the checks
// looked), strictly inside an allowed root by its real path too, not the user's home, not the home
// replacing it, and holding a keybase config. Runs before anything touches the service in `dir`.
export const checkRetirablePeerHome = (
  dir: string,
  keep: string,
  opts: {homeDir?: string; roots?: ReadonlyArray<string>} = {}
) => {
  const homeDir = path.resolve(opts.homeDir ?? os.homedir())
  const roots = opts.roots ?? peerHomeRoots()
  const refuse = (why: string) => new Error(`refusing to retire ${dir}: ${why}`)
  if (!path.isAbsolute(dir) || path.resolve(dir) !== dir.replace(/\/+$/, '')) throw refuse('not an absolute, normalised path')
  const abs = path.resolve(dir)
  if (abs === homeDir || homeDir.startsWith(abs + path.sep)) throw refuse('it is (or contains) the home directory')
  if (!roots.some(r => abs.startsWith(r) && abs.length > r.length)) throw refuse('not inside an e2e peer home root')
  if (realPath(abs) !== abs) throw refuse('it is, or is reached through, a symlink (or does not exist)')
  const insideRealRoot = roots.some(r => {
    const real = realPath(r)
    return real !== undefined && abs.startsWith(real + path.sep)
  })
  if (!insideRealRoot) throw refuse('its real path is not inside an e2e peer home root (the root is a symlink)')
  if (abs === path.resolve(keep)) throw refuse('it is the current peer home')
  if (!fs.existsSync(peerConfigPath(abs))) throw refuse('it has no keybase config, so it is not a peer home')
  return abs
}

// Throws unless `oldDevice` may be revoked: both in-use ids are known (an empty one would make the
// comparison pass vacuously) and it is neither of them.
export const checkRevocable = (oldDevice: string, currentPeerDevice: string, mainDevice: string) => {
  if (!oldDevice || !currentPeerDevice || !mainDevice) {
    throw new Error('refusing to revoke: the old, current peer or main device id is unknown')
  }
  if (oldDevice === currentPeerDevice || oldDevice === mainDevice) {
    throw new Error(`refusing to revoke ${oldDevice}: it is a device in use`)
  }
}

type PeerConfig = {current_user?: string; users?: Record<string, {device?: string}>}
export const readPeerConfig = (home: string): PeerConfig =>
  JSON.parse(fs.readFileSync(peerConfigPath(home), 'utf8')) as PeerConfig

export type RetireDeps = {
  // shuts the service in `home` down and waits for it to exit (a no-op when none runs)
  stop: (home: string) => Promise<void>
  revoke: (oldDevice: string) => Promise<void>
  remove: (home: string) => Promise<void>
  say: (s: string) => void
}

// Retires a peer home that a newer one replaced: checks the path first, shuts its service down (so
// it never sees its own revoke), revokes its device, then removes the directory.
export const retirePeerHome = async (
  p: {role: PeerRole; user: string; oldHome: string; newHome: string},
  deps: RetireDeps,
  opts: {homeDir?: string; roots?: ReadonlyArray<string>} = {}
) => {
  if (!fs.existsSync(p.oldHome)) {
    deps.say(`${p.role}: previous home ${p.oldHome} is already gone`)
    return
  }
  const abs = checkRetirablePeerHome(p.oldHome, p.newHome, opts)
  await deps.stop(abs)
  const cfg = readPeerConfig(abs)
  const users = Object.keys(cfg.users ?? {})
  if (cfg.current_user || users.length) {
    // A signed-in home must be the role's account.
    const oldDevice = cfg.users?.[p.user]?.device
    if (cfg.current_user !== p.user || users.some(u => u !== p.user) || !oldDevice) {
      throw new Error(`refusing to retire ${abs}: it is signed in as an account other than the ${p.role} one`)
    }
    await deps.revoke(oldDevice)
  } else {
    // A revoked device's service signs itself out and clears its config.
    deps.say(`${p.role}: ${abs} is signed out, so it has no device left to revoke`)
  }
  await deps.remove(abs)
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

// Throws unless `home` is a peer home the harness may shut down: absolute and normalised, strictly
// inside a peer-home root, and neither the user's home (the main service's) nor above it.
export const checkStoppablePeerHome = (home: string, opts: {homeDir?: string; roots?: ReadonlyArray<string>} = {}) => {
  const homeDir = path.resolve(opts.homeDir ?? os.homedir())
  const roots = opts.roots ?? peerHomeRoots()
  const refuse = (why: string) => new Error(`refusing to stop the service in ${home || '(no home)'}: ${why}`)
  if (!home || !path.isAbsolute(home) || path.resolve(home) !== home.replace(/\/+$/, '')) throw refuse('not an absolute, normalised path')
  const abs = path.resolve(home)
  if (abs === homeDir || homeDir.startsWith(abs + path.sep)) throw refuse("it is (or contains) the home directory, the main service's")
  if (!roots.some(r => abs.startsWith(r) && abs.length > r.length)) throw refuse('not inside an e2e peer home root')
  return abs
}

// Shuts a peer home's service down and waits for it to exit (pid read first: a clean shutdown
// removes the pid file). Only `ctl stop --shutdown`: plain `ctl stop` on macOS also quits every
// Keybase app on the machine. Never the main service: checkStoppablePeerHome runs first.
export const stopPeerHomeService = async (home: string) => {
  checkStoppablePeerHome(home)
  const socket = socketPathFor(home)
  const pidFile = path.join(home, 'Library', 'Caches', 'Keybase', 'keybased.pid')
  const pid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8').trim()) : NaN
  if (await socketAnswers(socket)) await runKeybase(['--home', home, 'ctl', 'stop', '--shutdown'], {timeoutMs: 30_000})
  await waitUntil(`the service in ${home} to exit`, 20_000, async () => {
    if (await socketAnswers(socket)) return false
    return !Number.isInteger(pid) || pid <= 0 || !pidAlive(pid)
  })
}

// The pids in a `ps -A -o pid=,command=` listing whose command line passes `--home <home>`.
export const homeServicePids = (ps: string, home: string) =>
  ps.split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line)
    if (!m) return []
    const args = (m[2] ?? '').split(/\s+/)
    const ours = args.some((a, i) => a === `--home=${home}` || (a === '--home' && args[i + 1] === home))
    return ours ? [Number(m[1])] : []
  })

export const serviceProcessesFor = (home: string) =>
  homeServicePids(execFileSync('ps', ['-A', '-o', 'pid=,command='], {encoding: 'utf8', timeout: 5_000}), home)

export type DirectRevokeDeps = {
  answers: (home: string) => Promise<boolean>
  // the live processes started for `home`
  pids: (home: string) => ReadonlyArray<number>
  // ctl stop --shutdown, waiting until it stops answering
  stop: (home: string) => Promise<void>
  revoke: () => Promise<void>
}

// Revokes a provisioned device without its home's checks, but never while a service for that home
// still runs. Its socket lives inside the home, so once the directory is gone (the sweeper's only
// caller case) `answers` is always false and the stop never runs: there the guard is the pid check,
// which refuses while a process started for the home is alive. The stop covers a home that still
// exists and answers.
export const revokeWithHomeStopped = async (home: string, deps: DirectRevokeDeps) => {
  if (await deps.answers(home)) await deps.stop(home)
  if (await deps.answers(home)) throw new Error(`refusing to revoke: the service in ${home} still answers after its shutdown`)
  const left = deps.pids(home)
  if (left.length) {
    throw new Error(`refusing to revoke: a service for ${home} still runs (pid ${left.join(', ')}) and has no socket to stop it through; stop it first`)
  }
  await deps.revoke()
}

// Removes a retired peer home, re-checking everything right before the delete.
export const removeRetiredPeerHome = async (dir: string, keep: string, smokeUser: string, say: (s: string) => void) => {
  await requireMainIsSmoke({smokeUser})
  const abs = checkRetirablePeerHome(dir, keep)
  if (await socketAnswers(socketPathFor(abs))) throw new Error(`refusing to remove ${dir}: its service still answers`)
  fs.rmSync(abs, {recursive: true})
  say(`removed ${abs}`)
}

export type SignalSource = {
  on: (signal: NodeJS.Signals, fn: () => void) => unknown
  off: (signal: NodeJS.Signals, fn: () => void) => unknown
}
const signalExitCodes: Partial<Record<NodeJS.Signals, number>> = {SIGINT: 130, SIGTERM: 143}

// Runs `work` then always `restore`. A SIGINT/SIGTERM that arrives meanwhile, a second one during
// `restore` included, is held until `restore` settles, then exits non-zero (saying first why a
// failed restore gave up): Ctrl-C mid account switch must not leave the main service signed in as
// another account. The switch's own child must run outside the terminal's process group (see
// runKeybase's `detached`), or the same Ctrl-C reaches it directly.
export const withSignalsDeferred = async <T,>(
  work: () => Promise<T>,
  restore: () => Promise<void>,
  deps: {signals?: SignalSource; exit?: (code: number) => void; say?: (s: string) => void} = {}
): Promise<T> => {
  const signals = deps.signals ?? process
  const exit = deps.exit ?? ((code: number) => process.exit(code))
  let caught: NodeJS.Signals | undefined
  const handlers = (['SIGINT', 'SIGTERM'] as const).map(sig => {
    const fn = () => {
      caught = caught ?? sig
      deps.say?.(`${sig}: finishing the main service's switch back first`)
    }
    signals.on(sig, fn)
    return [sig, fn] as const
  })
  try {
    return await work()
  } finally {
    let failed: {error: unknown} | undefined
    try {
      await restore()
    } catch (error) {
      failed = {error}
    }
    for (const [sig, fn] of handlers) signals.off(sig, fn)
    if (caught) {
      if (failed) deps.say?.(failed.error instanceof Error ? failed.error.message : String(failed.error))
      exit(signalExitCodes[caught] ?? 1)
    }
    // eslint-disable-next-line no-unsafe-finally
    if (failed) throw failed.error
  }
}

export type RestoreDeps = {
  // who the main service is signed in as, '' when it does not answer
  whoami: () => Promise<string>
  switchTo: (user: string) => Promise<void>
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  say?: (s: string) => void
}

// Switches the main service back to `smoke`, trying up to `attempts` times within `deadlineMs`, and
// returns only once whoami says `smoke`. Gives up with `fixCommand`, the command that fixes it by hand.
export const restoreMainAccount = async (
  smoke: string,
  fixCommand: string,
  deps: RestoreDeps,
  opts: {attempts?: number; deadlineMs?: number; backoffMs?: number} = {}
) => {
  const attempts = opts.attempts ?? 3
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? (async (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)))
  const deadline = now() + (opts.deadlineMs ?? 4 * 60_000)
  let last = ''
  let tried = 0
  for (; tried < attempts && now() < deadline; tried++) {
    if ((await deps.whoami()) === smoke) return
    try {
      await deps.switchTo(smoke)
      last = ''
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
    if ((await deps.whoami()) === smoke) return
    deps.say?.(`switching the main service back: attempt ${tried + 1} of ${attempts} failed${last ? ` (${last})` : ''}`)
    if (tried + 1 < attempts) await sleep(opts.backoffMs ?? 2_000)
  }
  if ((await deps.whoami()) === smoke) return
  throw new Error(
    `the main service is still not on the smoke account after ${tried} attempts${last ? ` (last: ${last})` : ''}; ` +
      `switch it back by hand: ${fixCommand}`
  )
}
