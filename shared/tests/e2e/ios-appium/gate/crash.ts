// Brings back an app that crashed (crash-lib.ts), through the hang watch's relaunch, and reads it back
// on the smoke account. hooks.ts calls it inside each attempt (before its cleanup steps and at its
// body's end, so the flow's afterEach finds the app up), in the root afterEach and in the root
// beforeEach.
import * as fs from 'fs'
import {withDeadline} from '../../shared/deadline.ts'
import {appPid, crashReportsSince} from '../helpers/lifecycle'
import {RELAUNCHED_SMOKE_MS, requireRelaunchedAppIsSmoke} from './accounts.ts'
import {type AttemptToken, endedRecord, openAttemptToken, requireCurrentAttempt, runAttempt} from './attempt.ts'
import {isAttemptOver} from './attempt-binding-lib.ts'
import {makeCrashRecovery, REPORT_WAIT_MS} from './crash-lib.ts'
import {relaunchHungApp} from './device.ts'
import {RELAUNCH_MS} from './hang.ts'
import {APP_POISON, isGatePoisonedBy, poisonGate} from './poison-lib.ts'

// the report wait, the relaunch, the read-back, and a margin
export const CRASH_RECOVERY_MS = REPORT_WAIT_MS + RELAUNCH_MS + RELAUNCHED_SMOKE_MS + 20_000

const mtimeMs = (file: string) => {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return 0
  }
}

const recovery = makeCrashRecovery(
  {
    appPid: () => appPid(),
    log: line => console.log(`[ios gate] ${line}`),
    now: () => Date.now(),
    relaunch: async () => withDeadline(relaunchHungApp(), RELAUNCH_MS, 'relaunching the gone app'),
    reportsSince: since => crashReportsSince(since).map(p => ({mtimeMs: mtimeMs(p), path: p})),
    sleep: async ms => new Promise(resolve => setTimeout(resolve, ms)),
    smoke: requireRelaunchedAppIsSmoke,
    stop: () => poisonGate(APP_POISON, 'launch the Keybase app on the simulator and check it shows the smoke account'),
    stopped: () => isGatePoisonedBy(APP_POISON),
  },
  Date.now()
)

// the crash each attempt failed of, kept for its body's end and the root afterEach
const crashes = new WeakMap<AttemptToken, string>()
const noted = (token: AttemptToken | undefined, why: string | undefined) => {
  if (token && why && !crashes.has(token)) crashes.set(token, why)
  return why
}

// Inside an attempt (before its cleanup steps, and at its body's end): an app that crashed is
// relaunched, and the crash this attempt saw is returned, for the test to fail of. An app gone with no
// crash report is left for the flow's own afterEach (a flow may have terminated it on purpose) and
// the root afterEach.
export const crashDuringAttempt = async () => {
  const token = openAttemptToken()
  // A body mocha timed out checks nothing: the root afterEach brings the app back. A check runs as the
  // attempt but bound to no body, so the body ending while it relaunches never refuses its commands.
  try {
    requireCurrentAttempt()
  } catch (e) {
    if (isAttemptOver(e)) return undefined
    throw e
  }
  noted(token, await runAttempt(token, async () => recovery.recover({crashOnly: true})))
  return token && crashes.get(token)
}

// In a root hook: brings back an app that is gone for any reason, inside `token`'s attempt while it is
// still open (a body mocha timed out), and says why it was gone. A recovery that fails poisons the gate
// instead of throwing, so every later test is refused with what to put back.
export const recoverGoneApp = async (token?: AttemptToken) =>
  noted(
    token,
    await recovery.recover({
      crashOnly: false,
      relaunch: async f => (token && !endedRecord(token) ? runAttempt(token, f) : f()),
    })
  )

// Waits for a recovery still running (one a body mocha timed out started), so a flow's afterEach
// never drives an app being relaunched. Its failure is the root hooks' to report.
export const settleCrashRecovery = async () => {
  const running = recovery.recovering()
  if (!running) return
  await withDeadline(
    running.catch(() => undefined),
    CRASH_RECOVERY_MS,
    "the gone app's recovery"
  )
}
