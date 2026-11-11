// The iOS release run's Metro and app launch. Metro is started from the checkout under test (yarn
// rn:start, watch mode, in its own process group so a Ctrl-C in the terminal reaches only the release
// command), its output to a log the run scans for secrets, and its group recorded in a pidfile so a
// later run can tell it from anyone else's Metro. The app is relaunched so it loads that bundle.
import {spawn, spawnSync} from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {groupAlive, sleep, stopGroup} from '../shared/gate/processes.ts'
import {portHolders} from '../shared/gate/ports.ts'
import {evalInPage, inspectorPageFor} from '../shared/metro-eval.ts'
import {assertServedFrom} from '../visual/served-tree.mts'
import {runSync} from './helpers/app.ts'
import {
  APP_ACCOUNT_BODY,
  LOCATION_PERMISSION,
  PUSH_HAS_PERMISSIONS,
  settledAccount,
  type AppAccount,
  type LocationPermission,
} from './gate/app-account-lib.ts'
import {goLogIn, linesSince, markFile, type LogMark} from './gate/go-log-lib.ts'
import {delivererInterval, linesFrom, outboxFlushes} from './gate/outbox-lib.ts'
import {isMetroGroup, parsePs} from './release-lib.ts'

export const BUNDLE_ID = 'keybase.ios'
export const METRO_PORT = 8081
const METRO_PIDFILE = '/tmp/kb-e2e/ios-metro.json'
// Metro always starts with --clear, so its first bundle is slow: the app gets longer to connect.
const METRO_UP_MS = 3 * 60_000
const APP_UP_MS = 5 * 60_000
// the app reads its push permission from iOS shortly after launch, so a false holds this long first
const PUSH_SETTLE_MS = 30_000
// the app loads its theme preference shortly after launch, so a mismatch holds this long first
const THEME_SETTLE_MS = 15_000
const LOCATION_READ_MS = 15_000
// the service's deliverer logs its start within a minute of a launch
const DELIVERER_UP_MS = 60_000
// pulls of the outbox the read waits for after the deliverer starts, one each interval
const OUTBOX_PULLS = 3
// the longest deliverer interval the outbox read waits on (the service pulls every 5s unless set)
const MAX_DELIVERER_INTERVAL_MS = 60_000

type MetroPidfile = {pgid: number; start: number}

export const readMetroPidfile = (): MetroPidfile | undefined => {
  try {
    const v = JSON.parse(fs.readFileSync(METRO_PIDFILE, 'utf8')) as Partial<MetroPidfile>
    return typeof v.pgid === 'number' && v.pgid > 1 ? {pgid: v.pgid, start: v.start ?? 0} : undefined
  } catch {
    return undefined
  }
}

// a ps that failed reads as no processes
export const processes = () => {
  const r = spawnSync('ps', ['-axww', '-o', 'pid=,ppid=,pgid=,etime=,command='], {encoding: 'utf8', timeout: 10_000})
  return r.error ? [] : parsePs(r.stdout, Date.now())
}

// Whether a process group is still running a Metro (release-lib.ts isMetroGroup), as one ps and one
// lsof read now say: a recorded group id is only ever signalled while it is.
export const metroGroups = () => {
  const rows = processes()
  const holders = portHolders(METRO_PORT)
  const portPgids = 'error' in holders ? [] : holders.holders.map(h => h.pgid)
  return (pgid: number) => groupAlive(pgid) && isMetroGroup(rows, pgid, portPgids)
}

// The Metro group an earlier release run recorded and that is still running, if any.
export const recordedMetroPgid = () => {
  const r = readMetroPidfile()
  return r && metroGroups()(r.pgid) ? r.pgid : undefined
}

// Drops the pidfile when it still records `pgid`.
export const forgetMetroPidfile = (pgid: number) => {
  if (readMetroPidfile()?.pgid === pgid) fs.rmSync(METRO_PIDFILE, {force: true})
}

export const stopMetro = async (pgid: number) => {
  await stopGroup(pgid)
  forgetMetroPidfile(pgid)
}

const until = async <T,>(what: string, ms: number, f: () => Promise<T | undefined>, last: () => string = () => '') => {
  const end = Date.now() + ms
  for (;;) {
    const v = await f()
    if (v !== undefined) return v
    if (Date.now() > end) throw new Error(`timed out after ${Math.round(ms / 1000)}s waiting for ${what}${last() ? ` (last: ${last()})` : ''}`)
    await sleep(1_000)
  }
}

const metroRunning = async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${METRO_PORT}/status`, {signal: AbortSignal.timeout(2_000)})
    return (await res.text()).includes('packager-status:running')
  } catch {
    return false
  }
}

// Starts Metro from `sharedDir` with its output truncated into `logFile`, records its group, and
// waits for it to answer. Returns the group id; `onStarted` gets it as soon as it exists, so an
// interrupt during the wait still stops it.
export const startMetro = async (o: {sharedDir: string; logFile: string; log: (s: string) => void; onStarted: (pgid: number) => void}) => {
  fs.mkdirSync(path.dirname(o.logFile), {recursive: true})
  const out = fs.openSync(o.logFile, 'w')
  // watch mode: CI=1 turns Metro's file watching off
  const env = {...process.env}
  delete env['CI']
  const child = spawn('yarn', ['rn:start'], {cwd: o.sharedDir, detached: true, env, stdio: ['ignore', out, out]})
  child.unref()
  fs.closeSync(out)
  const pgid = child.pid
  if (pgid === undefined) throw new Error('yarn rn:start did not start')
  fs.mkdirSync(path.dirname(METRO_PIDFILE), {recursive: true})
  fs.writeFileSync(METRO_PIDFILE, JSON.stringify({pgid, start: Date.now()} satisfies MetroPidfile))
  o.onStarted(pgid)
  o.log(`Metro: started from ${o.sharedDir} (process group ${pgid}), log ${o.logFile}`)
  await until(`Metro on port ${METRO_PORT}`, METRO_UP_MS, async () => {
    if (!groupAlive(pgid)) throw new Error(`Metro exited before answering; see ${o.logFile}`)
    return (await metroRunning()) ? true : undefined
  })
  assertServedFrom(METRO_PORT, o.sharedDir, 'Metro')
  return pgid
}

// Terminates and relaunches the app so it loads the bundle this run's Metro serves, then waits for
// its JS runtime to say who it is signed in as (app-account-lib.ts settledAccount: a signed-out answer
// only once it has held, as a new runtime reports one until its service answers).
export const relaunchApp = async (o: {device: string; udid: string; log: (s: string) => void}): Promise<AppAccount> => {
  try {
    runSync('xcrun', ['simctl', 'terminate', o.udid, BUNDLE_ID], 30_000)
  } catch {}
  runSync('xcrun', ['simctl', 'launch', o.udid, BUNDLE_ID], 60_000)
  o.log(`relaunched ${BUNDLE_ID} on ${o.device}; waiting for its bundle`)
  let last = ''
  let firstAnswerAt: number | undefined
  return until(
    'the app to load its bundle and report its account',
    APP_UP_MS,
    async () => {
      try {
        const a = await evalInPage<AppAccount>(await inspectorPageFor(o.device, BUNDLE_ID), APP_ACCOUNT_BODY)
        firstAnswerAt ??= Date.now()
        last = a.switching ? 'switching accounts' : a.loggedIn && a.username ? '' : 'not signed in yet'
        return settledAccount(a, firstAnswerAt, Date.now())
      } catch (e) {
        last = e instanceof Error ? e.message : String(e)
        return undefined
      }
    },
    () => last
  )
}

// Whether the just-launched app holds push permission: true once it reads so, false once it has read
// otherwise for PUSH_SETTLE_MS. An eval that fails throws.
export const appHasPushPermission = async (device: string): Promise<boolean> => {
  const end = Date.now() + PUSH_SETTLE_MS
  for (;;) {
    if (await evalInPage<boolean>(await inspectorPageFor(device, BUNDLE_ID), `return ${PUSH_HAS_PERMISSIONS}`)) return true
    if (Date.now() > end) return false
    await sleep(1_000)
  }
}

// Whether the just-launched app draws dark, once it agrees with `expected`, otherwise after
// THEME_SETTLE_MS (stores/darkmode.tsx; no RPC). An eval that fails throws.
export const appDrawsDark = async (device: string, expected: boolean): Promise<boolean> => {
  const end = Date.now() + THEME_SETTLE_MS
  for (;;) {
    const dark = await evalInPage<boolean>(await inspectorPageFor(device, BUNDLE_ID), "return kbModule('stores/darkmode.tsx').useDarkModeState.getState().isDarkMode()")
    if (dark === expected || Date.now() > end) return dark
    await sleep(1_000)
  }
}

// The just-launched app's location permission. The read is a promise, so its answer waits under a
// global the next evals poll (as gate/app-ask.ts askApp does; no recorder runs yet, and it sends no
// RPC). A read that fails or does not answer within LOCATION_READ_MS throws.
export const appLocationPermission = async (device: string): Promise<LocationPermission> => {
  const page = async () => inspectorPageFor(device, BUNDLE_ID)
  await evalInPage<boolean>(
    await page(),
    `globalThis.__kbE2ELaunchLocation = {state: 'pending'}
     Promise.resolve()
       .then(() => ${LOCATION_PERMISSION})
       .then(value => (globalThis.__kbE2ELaunchLocation = {state: 'answered', value}), e => (globalThis.__kbE2ELaunchLocation = {state: 'failed', error: String(e && e.message)}))
     return true`
  )
  return until('the app to read its location permission', LOCATION_READ_MS, async () => {
    const r = await evalInPage<{state: string; value?: LocationPermission; error?: string}>(await page(), 'return globalThis.__kbE2ELaunchLocation')
    if (r.state === 'failed') throw new Error(`reading the app's location permission failed: ${r.error ?? '?'}`)
    return r.state === 'answered' ? r.value : undefined
  })
}

// Where the app's Go log ends now. Taken before the app is launched, so what appPendingOutbox reads
// is only what the Go log gained after it (the launch replaces ios.log; a rotation moves it aside,
// and go-log-lib.ts follows the marked file by its inode).
export const goLogMarkFor = (udid: string) =>
  markFile(goLogIn(runSync('xcrun', ['simctl', 'get_app_container', udid, BUNDLE_ID, 'data'], 30_000).trim()))

// The chat records pending in the just-launched app's outbox, per conversation (gate/outbox-lib.ts):
// what the latest pull logged, once its service's deliverer has started and pulled the outbox
// OUTBOX_PULLS times (each pull logs every conversation with a pending record). Throws when the deliverer never
// starts.
export const appPendingOutbox = async (mark: LogMark, launchedAt: number) => {
  // every line since the mark, from the first stamped at or after the launch
  const goLog = () => linesFrom(linesSince(mark), launchedAt)
  const interval = await until('the phone service to start delivering chat messages', DELIVERER_UP_MS, async () =>
    Promise.resolve(delivererInterval(goLog()))
  )
  // a longer one is a misread line, and would hold the launch phase that many pulls
  if (interval > MAX_DELIVERER_INTERVAL_MS) throw new Error(`the phone service's deliverer logged an interval of ${interval}ms, over the ${MAX_DELIVERER_INTERVAL_MS}ms the outbox read waits on`)
  await sleep(OUTBOX_PULLS * interval + 1_000)
  return outboxFlushes(goLog(), {end: Date.now(), interval})
}
