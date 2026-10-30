// The iOS release gate's flow run: every attempt is recorded under tests/results/ios-report/attempts
// (gate/attempt.ts), and onComplete writes them as the Playwright json report the release summary
// and the census read.
import * as fs from 'fs'
import * as path from 'path'
import {config as base} from './wdio.conf'
import {escapeToTabs} from './helpers/navigate'
import {attemptToken, currentAttempt, endAttempt, IOS_REPORT_DIR, readAttempts, type AttemptToken} from './gate/attempt'
import {PhoneRecording} from './gate/recorder'
import {buildPwReport} from './gate/results-lib'
import {appLogTail, beginErrorCapture, takeErrors} from './gate/errors'
import {uncaughtErrors} from './gate/step-lib'
import {requireAppIsSmoke} from './gate/accounts'

const PROJECT = 'ios-flows'

// each attempt's recorder, so a timed-out body that finishes late reaches only its own
type Recorder = {recording?: PhoneRecording; error?: string; captureError?: string}
const recorders = new WeakMap<AttemptToken, Recorder>()

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
    const rec: Recorder = {}
    recorders.set(attemptToken(), rec)
    // wdio runs the test whatever this hook throws, so the root beforeEach in gate/hooks.ts fails a
    // test on the wrong account; here it keeps the recorder from starting on it
    const accountError = await requireAppIsSmoke().then(
      () => '',
      (e: unknown) => message(e)
    )
    if (accountError) {
      rec.error = accountError
      return
    }
    await escapeToTabs()
    await beginErrorCapture().catch((e: unknown) => {
      rec.captureError = `starting the error capture: ${message(e)}`
    })
    const r = new PhoneRecording()
    await r.begin().then(
      () => {
        rec.recording = r
      },
      (e: unknown) => {
        rec.error = `starting the recorder: ${message(e)}`
      }
    )
  },
  afterTest: async (_test, _context, result: {passed: boolean; skipped?: boolean; duration: number; error?: Error}) => {
    const attempt = currentAttempt()
    const rec = recorders.get(attemptToken())
    // an attempt failed only by its coverage record gets none: the screen was fine, the recorder was not
    if (!result.passed && !result.skipped) {
      const png = await browser.takeScreenshot().catch(() => undefined)
      if (png) attempt.addAttachment('screenshot', 'image/png', Buffer.from(png, 'base64'))
    }
    // console errors are attached, as the desktop's are; an uncaught JS error fails a passing attempt
    let errors: Array<string> = []
    let captureError = rec?.captureError
    try {
      errors = await takeErrors()
    } catch (e) {
      captureError ??= `reading the app's errors: ${message(e)}`
    }
    const uncaught = uncaughtErrors(errors)
    const consoleErrors = errors.filter(e => !uncaught.includes(e))
    if (consoleErrors.length) attempt.addAttachment('renderer-console-errors', 'text/plain', consoleErrors.join('\n\n'))
    if (uncaught.length) attempt.addAttachment('renderer-page-errors', 'text/plain', uncaught.join('\n\n'))
    if (!result.passed && !result.skipped) {
      let tail: string
      try {
        tail = appLogTail(80)
      } catch (e) {
        tail = `unavailable: ${message(e)}`
      }
      attempt.addAttachment('app-log-tail', 'text/plain', tail)
    }
    let got = {reloads: 0, routes: [] as Array<string>, rpcs: [] as Array<string>, startRoutes: [] as Array<string>}
    let error = rec?.error ?? (rec?.recording ? '' : 'the recorder was not started')
    if (rec?.recording) {
      try {
        const r = await rec.recording.finish()
        got = {reloads: r.reloads, routes: r.routes, rpcs: r.rpcs, startRoutes: r.startRoutes}
      } catch (e) {
        error = message(e)
      }
    }
    error ||= captureError ?? ''
    const coverage = {...(error ? {error} : {}), ...got}
    attempt.addAttachment('coverage.json', 'application/json', JSON.stringify(coverage, null, 2))
    // a failed attempt already has its reason; a passing one fails for the missing record
    const coverageFails = !!error && result.passed
    const uncaughtFails = uncaught.length > 0 && result.passed && !coverageFails
    endAttempt({
      durationMs: result.duration,
      status: coverageFails || uncaughtFails || (!result.passed && !result.skipped) ? 'failed' : result.skipped ? 'skipped' : 'passed',
      ...(coverageFails
        ? {error: `coverage not recorded: ${error}`}
        : uncaughtFails
          ? {error: `uncaught app error(s) during the test:\n${uncaught.join('\n\n')}`}
          : result.error ? {error: result.error.message} : {}),
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
