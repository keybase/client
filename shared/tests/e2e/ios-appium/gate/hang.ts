// Watches the app during a test body for the main thread stuck in UIKit's accessibility snapshot
// (hang-lib.ts). Once it has been stuck, with no Appium command completing, long enough that no
// query can be slow work, the app is killed and launched again and the watch's promise gives the
// reason, so the body is failed at once (hooks.ts) and its cleanup has an app to drive, instead of
// every query and eval waiting out its bound.
import {execFile, execFileSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {appPid, BUNDLE_ID, deviceUdid, simctl, terminateApp} from '../helpers/lifecycle'
import {iosReportDir} from './attempt.ts'
import {makeWatchSlot, mainThreadInSnapshot, nextHangState, NO_HANG} from './hang-lib.ts'

const READ_EVERY_MS = 15_000
// four reads in a row, 45s or more apart from the first, with no command completing between them
const STUCK_READS = 4
const SAMPLE_MS = 20_000

// the hang spins the main thread, a whole core
const BUSY_CPU_PERCENT = 90

// Appium commands completed this run (wdio.gate.conf.ts afterCommand): a stuck app completes none.
let commandsDone = 0
export const noteCommandDone = () => {
  commandsDone++
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

const slot = makeWatchSlot()

// Starts the watch for one test body, stopping any earlier one (a body mocha timed out never stopped
// its own). The promise resolves with the reason once the watch has relaunched a hung app; it never
// resolves otherwise.
export const startHangWatch = async (): Promise<string> => {
  let found: (why: string) => void = () => {}
  const hung = new Promise<string>(resolve => {
    found = resolve
  })
  let state = NO_HANG
  let busy = false
  let hang: string | undefined
  const read = async () => {
    const pid = appPid()
    // sampling slows the app for its second, so only an app busy on a whole core is sampled
    if (pid === undefined || appCpuPercent(pid) < BUSY_CPU_PERCENT) {
      state = NO_HANG
      return
    }
    const report = await sampleApp(pid)
    state = nextHangState(state, {commandsDone, inSnapshot: mainThreadInSnapshot(report)})
    if (state.stuck < STUCK_READS) return
    const file = path.join(iosReportDir(), `app-hang-${Date.now()}.txt`)
    fs.mkdirSync(iosReportDir(), {recursive: true})
    fs.writeFileSync(file, report)
    hang = `the app hung: its main thread was stuck in UIKit's accessibility snapshot (the call that answers an XCUITest query), with no Appium command completing, for ${((STUCK_READS - 1) * READ_EVERY_MS) / 1000}s or more; the gate killed and relaunched it (its sample: ${file})`
    try {
      await terminateApp()
      simctl('launch', deviceUdid(), BUNDLE_ID)
    } finally {
      found(hang)
    }
  }
  const timer = setInterval(() => {
    if (busy || hang) return
    busy = true
    // a read that failed (the app exiting mid-sample) only waits for the next
    void read()
      .catch(() => {})
      .finally(() => {
        busy = false
      })
  }, READ_EVERY_MS)
  slot.start(() => {
    clearInterval(timer)
    return hang
  })
  return hung
}

// Stops the running watch, if any, and returns what it found.
export const stopHangWatch = () => slot.stop()
