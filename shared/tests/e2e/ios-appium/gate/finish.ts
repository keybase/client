// Ends the running attempt with what the harness attaches to it: a failure's screenshot and app log,
// the app's console and uncaught errors, and its coverage record. wdio's afterTest ends an attempt
// this way, and the root afterEach (gate/hooks.ts) one that afterTest never reached.
import {attemptToken, currentAttempt, endAttempt} from './attempt.ts'
import {recorders} from './recording.ts'
import {appLogTail, takeErrors} from './errors.ts'
import {uncaughtErrors} from './step-lib.ts'

export type TestResult = {passed: boolean; skipped?: boolean; duration: number; error?: Error}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const finishAttempt = async (result: TestResult) => {
  const attempt = currentAttempt()
  const rec = recorders.get(attemptToken())
  const failed = !result.passed && !result.skipped
  // an attempt failed only by its coverage record gets none: the screen was fine, the recorder was not
  if (failed) {
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
  if (failed) {
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
    status: coverageFails || uncaughtFails || failed ? 'failed' : result.skipped ? 'skipped' : 'passed',
    ...(coverageFails
      ? {error: `coverage not recorded: ${error}`}
      : uncaughtFails
        ? {error: `uncaught app error(s) during the test:\n${uncaught.join('\n\n')}`}
        : result.error
          ? {error: result.error.message}
          : {}),
  })
}
