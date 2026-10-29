// The iOS release gate's flow run: every attempt is recorded under tests/results/ios-report/attempts
// (gate/attempt.ts), and onComplete writes them as the Playwright json report the release summary
// and the census read.
import * as fs from 'fs'
import * as path from 'path'
import {config as base} from './wdio.conf'
import {escapeToTabs} from './helpers/navigate'
import {currentAttempt, endAttempt, IOS_REPORT_DIR, readAttempts} from './gate/attempt'
import {PhoneRecording} from './gate/recorder'
import {buildPwReport} from './gate/results-lib'

const PROJECT = 'ios-flows'

let recording: PhoneRecording | undefined
let recorderError: string | undefined

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const config: WebdriverIO.Config = {
  ...base,
  specs: ['./gate.test.ts'],
  mochaOpts: {...base.mochaOpts, grep: process.env['KB_E2E_RELEASE_ONLY'], retries: 1},
  // a results.json never mixes runs
  onPrepare: [
    ...[base.onPrepare ?? []].flat(),
    () => {
      fs.rmSync(IOS_REPORT_DIR, {force: true, recursive: true})
    },
  ],
  // wdio only logs a beforeTest error and runs the test anyway, so afterTest reports a recorder that
  // did not start
  beforeTest: async () => {
    recording = undefined
    recorderError = undefined
    await escapeToTabs()
    const r = new PhoneRecording()
    await r.begin().then(
      () => {
        recording = r
      },
      (e: unknown) => {
        recorderError = `starting the recorder: ${message(e)}`
      }
    )
  },
  afterTest: async (_test, _context, result: {passed: boolean; skipped?: boolean; duration: number; error?: Error}) => {
    const attempt = currentAttempt()
    if (!result.passed && !result.skipped) {
      const png = await browser.takeScreenshot().catch(() => undefined)
      if (png) attempt.addAttachment('screenshot', 'image/png', Buffer.from(png, 'base64'))
    }
    let got = {reloads: 0, routes: [] as Array<string>, rpcs: [] as Array<string>, startRoutes: [] as Array<string>}
    let error = recorderError ?? (recording ? '' : 'the recorder was not started')
    if (recording) {
      try {
        const r = await recording.finish()
        got = {reloads: r.reloads, routes: r.routes, rpcs: r.rpcs, startRoutes: r.startRoutes}
      } catch (e) {
        error = message(e)
      }
    }
    recording = undefined
    const coverage = {...(error ? {error} : {}), ...got}
    attempt.addAttachment('coverage.json', 'application/json', JSON.stringify(coverage, null, 2))
    // a failed attempt already has its reason; a passing one fails for the missing record
    const coverageFails = !!error && result.passed
    endAttempt({
      durationMs: result.duration,
      status: coverageFails || (!result.passed && !result.skipped) ? 'failed' : result.skipped ? 'skipped' : 'passed',
      ...(coverageFails ? {error: `coverage not recorded: ${error}`} : result.error ? {error: result.error.message} : {}),
    })
  },
  onComplete: (exitCode: number) => {
    const attempts = readAttempts()
    const report = buildPwReport(attempts, PROJECT)
    // a hook or worker failure leaves no failed attempt behind it
    if (exitCode !== 0 && !attempts.some(a => a.status === 'failed')) {
      report.errors.push(`wdio exited ${exitCode} with no failed test attempt`)
    }
    fs.mkdirSync(IOS_REPORT_DIR, {recursive: true})
    fs.writeFileSync(path.join(IOS_REPORT_DIR, 'results.json'), JSON.stringify(report, null, 2))
  },
}
