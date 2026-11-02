// Watches the app during a test body for the main thread stuck in UIKit's accessibility snapshot
// (hang-lib.ts). Once it has been stuck, with no WebDriver request succeeding, long enough that no
// query can be slow work, the app is relaunched and the watch's promise gives the reason, so the
// body is failed at once (hooks.ts) and its cleanup has an app to drive, instead of every query and
// eval waiting out its bound.
import {execFile, execFileSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {withDeadline} from '../../shared/deadline.ts'
import {appPid} from '../helpers/lifecycle'
import {attemptToken, iosReportDir, runAttempt} from './attempt.ts'
import {relaunchHungApp} from './device.ts'
import {countsForHangWatch, makeHangWatch, makeWatchSlot, settleRelaunch, STUCK_READS} from './hang-lib.ts'

const READ_EVERY_MS = 15_000
const SAMPLE_MS = 20_000
// reading the hung app's errors (which fails), its kill, its launch and its new runtime
export const RELAUNCH_MS = 180_000

// WebDriver requests that succeeded this run (wdio.gate.conf.ts listens to webdriver's 'result'
// event): a hung app answers none.
let succeeded = 0
export const noteProtocolResult = (event: {command?: string; result?: unknown}) => {
  if (countsForHangWatch(event)) succeeded++
}

const appCpuPercent = (pid: number) => {
  try {
    return Number(execFileSync('/bin/ps', ['-o', '%cpu=', '-p', String(pid)], {encoding: 'utf8', timeout: 5_000}).trim()) || 0
  } catch {
    return 0
  }
}

// One second of the app's threads, written to a file of its own (sample keeps one in /tmp otherwise).
const sampleApp = async (pid: number) => {
  const file = path.join(os.tmpdir(), `kb-e2e-app-sample-${pid}-${Date.now()}.txt`)
  try {
    await new Promise<void>((resolve, reject) => {
      execFile('/usr/bin/sample', [String(pid), '1', '-file', file], {timeout: SAMPLE_MS}, e => {
        if (e) reject(new Error(`sampling the app: ${e.message}`))
        else resolve()
      })
    })
    return fs.readFileSync(file, 'utf8')
  } finally {
    fs.rmSync(file, {force: true})
  }
}

const keepSample = (report: string) => {
  const file = path.join(iosReportDir(), `app-hang-${Date.now()}.txt`)
  fs.mkdirSync(iosReportDir(), {recursive: true})
  fs.writeFileSync(file, report)
  return `the app hung: its main thread was stuck in UIKit's accessibility snapshot (the call that answers an XCUITest query), with no WebDriver request succeeding, for ${((STUCK_READS - 1) * READ_EVERY_MS) / 1000}s or more; the gate relaunched it (its sample: ${file})`
}

const slot = makeWatchSlot()

// Starts the watch for one test body, stopping any earlier one (a body mocha timed out never stopped
// its own). Started inside the body's attempt, as the relaunch moves the attempt's recording to the
// new runtime. The relaunch runs as a hook bound to the attempt, not as the body: mocha can time the
// body out mid-relaunch, and the hook after it waits for the relaunch, which must not then be refused
// as attempt over. The promise resolves with the reason once the watch has relaunched a hung app; it
// never resolves otherwise.
export const startHangWatch = async (): Promise<string> => {
  const token = attemptToken()
  const watch = makeHangWatch({
    appPid: () => appPid(),
    cpuPercent: appCpuPercent,
    keep: keepSample,
    relaunch: async () => runAttempt(token, async () => withDeadline(relaunchHungApp(), RELAUNCH_MS, 'relaunching the hung app')),
    sample: sampleApp,
    succeeded: () => succeeded,
  })
  let busy = false
  // The timer is started bound to no body, as a hook's work: its reads must keep running once the body
  // is over (a mocha timeout runs the flow's afterEach hooks before the root one stops the watch),
  // and a timer started in the body's context would refuse them as attempt over.
  const timer = runAttempt(undefined, () =>
    setInterval(() => {
    if (busy) return
    busy = true
    // a read that failed (the app exiting mid-sample) only waits for the next
    void watch
      .read()
      .catch(() => {})
      .finally(() => {
        busy = false
      })
    }, READ_EVERY_MS)
  )
  slot.start({
    relaunching: watch.relaunching,
    stop: () => {
      clearInterval(timer)
      return watch.stop()
    },
  })
  return watch.hung
}

// Stops the running watch, if any, and returns what it found.
export const stopHangWatch = () => slot.stop()

// Waits for a relaunch a watch started (a body mocha timed out stopped its watch mid-relaunch), so
// the next test never finds the app restarting; throws when it runs past its own bound and a margin.
export const HANG_SETTLE_MS = RELAUNCH_MS + 30_000
export const settleHangRelaunch = async () => settleRelaunch(slot.relaunching(), HANG_SETTLE_MS)
