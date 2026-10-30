// Watches the app during a test for the main thread stuck in UIKit's accessibility snapshot
// (hang-lib.ts). Once it has been stuck long enough that no query can be slow work, the app is
// killed and launched again, so the test fails at once with the reason and its cleanup has an app to
// drive, instead of every query and eval waiting out its bound.
import {execFile, execFileSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {appPid, BUNDLE_ID, deviceUdid, simctl, terminateApp} from '../helpers/lifecycle'
import {iosReportDir} from './attempt.ts'
import {mainThreadInSnapshot, nextStuckReads} from './hang-lib.ts'

const READ_EVERY_MS = 15_000
// four reads in a row, 45s or more apart from the first: a snapshot of even the largest screen takes
// a few seconds
const STUCK_READS = 4
const SAMPLE_MS = 20_000

// the hang spins the main thread, a whole core
const BUSY_CPU_PERCENT = 90

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

// Starts the watch; returns its stop, which says why the app was relaunched, if it was.
export const watchAppHang = () => {
  let stuck = 0
  let busy = false
  let hang: string | undefined
  const read = async () => {
    const pid = appPid()
    if (pid === undefined) {
      stuck = 0
      return
    }
    // sampling slows the app for its second, so only an app busy on a whole core is sampled
    if (appCpuPercent(pid) < BUSY_CPU_PERCENT) {
      stuck = 0
      return
    }
    const report = await sampleApp(pid)
    stuck = nextStuckReads(stuck, mainThreadInSnapshot(report))
    if (stuck < STUCK_READS) return
    const file = path.join(iosReportDir(), `app-hang-${Date.now()}.txt`)
    fs.mkdirSync(iosReportDir(), {recursive: true})
    fs.writeFileSync(file, report)
    hang = `the app hung: its main thread was stuck in UIKit's accessibility snapshot (the call that answers an XCUITest query) for ${((STUCK_READS - 1) * READ_EVERY_MS) / 1000}s or more, so no query or eval could answer; the gate killed and relaunched it (its sample: ${file})`
    await terminateApp()
    simctl('launch', deviceUdid(), BUNDLE_ID)
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
  return () => {
    clearInterval(timer)
    return hang
  }
}
