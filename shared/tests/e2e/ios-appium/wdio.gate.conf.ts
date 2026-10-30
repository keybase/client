// The iOS release gate's flow run: every attempt is recorded under tests/results/ios-report/attempts
// (gate/attempt.ts), and onComplete writes them as the Playwright json report the release summary
// and the census read.
import * as fs from 'fs'
import * as path from 'path'
import {config as base} from './wdio.conf'
import {escapeToTabs} from './helpers/navigate'
import {attemptToken, iosReportDir, readAttempts, readRunErrors} from './gate/attempt'
import {type Recorder, recorders} from './gate/recording'
import {PhoneRecording} from './gate/recorder'
import {buildPwReport} from './gate/results-lib'
import {beginErrorCapture} from './gate/errors'
import {finishAttempt, type TestResult} from './gate/finish'
import {noteProtocolResult} from './gate/hang'

const PROJECT = 'ios-flows'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const config: WebdriverIO.Config = {
  ...base,
  specs: ['./gate.test.ts'],
  mochaOpts: {...base.mochaOpts, grep: process.env['KB_E2E_RELEASE_ONLY'], retries: 1},
  // a results.json never mixes runs
  onPrepare: [
    ...[base.onPrepare ?? []].flat(),
    () => {
      fs.rmSync(iosReportDir(), {force: true, recursive: true})
    },
  ],
  // wdio only logs a beforeTest error and runs the test anyway, so nothing here throws: what failed
  // is kept on the attempt's recorder for afterTest to report. The account was checked before this
  // (gate/hooks.ts).
  before: [
    ...[base.before ?? []].flat(),
    // what the app-hang watch counts: WebDriver requests that got a successful answer
    () => {
      browser.on('result', (event: {result?: unknown}) => {
        noteProtocolResult(event.result)
      })
    },
  ],
  beforeTest: async () => {
    const rec: Recorder = {}
    recorders.set(attemptToken(), rec)
    await escapeToTabs().catch((e: unknown) => {
      rec.error = `resetting to the tab root: ${message(e)}`
    })
    await beginErrorCapture().catch((e: unknown) => {
      rec.captureError = `starting the error capture: ${message(e)}`
    })
    const r = new PhoneRecording()
    await r.begin().then(
      () => {
        rec.recording = r
      },
      (e: unknown) => {
        rec.error ??= `starting the recorder: ${message(e)}`
      }
    )
  },
  afterTest: async (_test, _context, result: TestResult) => finishAttempt(result),
  onComplete: (exitCode: number) => {
    const attempts = readAttempts()
    const report = buildPwReport(attempts, PROJECT)
    report.errors.push(...readRunErrors())
    // a hook or worker failure leaves no failed attempt behind it
    if (exitCode !== 0 && !attempts.some(a => a.status === 'failed')) {
      report.errors.push(`wdio exited ${exitCode} with no failed test attempt`)
    }
    fs.mkdirSync(iosReportDir(), {recursive: true})
    fs.writeFileSync(path.join(iosReportDir(), 'results.json'), JSON.stringify(report, null, 2))
  },
}
