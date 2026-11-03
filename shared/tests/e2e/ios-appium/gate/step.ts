// Steps of a flow: screenshots attached to the running attempt, as the desktop flows' step.ts does.
import {currentAttempt, requireCurrentAttempt} from './attempt'
import {isAttemptOver} from './attempt-binding-lib'
import {requireNoSecretOnScreen} from './secret-screen.ts'
import {stepAttachmentName} from '../../shared/step-name.ts'

const sleep = async (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// A screenshot once the screen stops changing (a sheet sliding in, a keyboard), or the last one taken
// when it doesn't within settleMs (a spinner).
const settleMs = 1_000
const settledScreenshot = async (): Promise<string> => {
  let last = await browser.takeScreenshot()
  for (const until = Date.now() + settleMs; Date.now() < until; ) {
    await sleep(100)
    const next = await browser.takeScreenshot()
    if (next === last) return next
    last = next
  }
  return last
}

// Attaches a screenshot of the current state, once it has settled, as step-NN-<name>, NN counting from
// 01 within the attempt. {card: true} marks the step whose screenshot is the test's card image in the
// report; with no marked step the first step is. {settle: false} takes it at once. {screenshot: false}
// records only the step's name (a 'step' annotation), for a screen that shows more than the test's
// own data, such as the inbox, which holds conversations that are not test ones.
// Like every app command, refuses to run in a test body mocha timed out; and refuses while a secret
// is on screen (secret-screen.ts).
export async function step(name: string, opts?: {card?: boolean; settle?: boolean} | {screenshot: false}): Promise<void> {
  const attempt = currentAttempt()
  requireNoSecretOnScreen()
  const attName = stepAttachmentName(attempt.nextStepIndex(), name)
  if (opts && 'screenshot' in opts) {
    attempt.annotate('step', attName)
    return
  }
  const png = opts?.settle === false ? await browser.takeScreenshot() : await settledScreenshot()
  attempt.addAttachment(attName, 'image/png', Buffer.from(png, 'base64'))
  if (opts?.card) attempt.annotate('card-step', attName)
}

// A step at the point where a human has to take over; the report's checklist links to this screenshot.
export async function manualEdge(id: string): Promise<void> {
  currentAttempt().annotate('manual-only', id)
  await step(`manual-${id}`)
}

// Runs `attempt` until it passes, for a navigation that may need more than one try. `intervals` are the
// waits between tries (the last repeats) and `timeout` bounds all of them. A pass that took more than
// one try is annotated `retried`, so a helper that starts needing many tries shows in the report. A
// test body mocha timed out is never tried again.
export async function retriedNavigation(
  what: string,
  attempt: () => Promise<void>,
  opts: {intervals: Array<number>; timeout: number}
): Promise<void> {
  const until = Date.now() + opts.timeout
  let tries = 0
  for (;;) {
    requireCurrentAttempt()
    tries++
    try {
      await attempt()
      break
    } catch (e) {
      if (isAttemptOver(e)) throw e
      const wait = opts.intervals[Math.min(tries - 1, opts.intervals.length - 1)] ?? 100
      if (Date.now() + wait > until) throw new Error(`${what}: still failing after ${tries} tries: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
      await sleep(wait)
    }
  }
  if (tries > 1) currentAttempt().annotate('retried', `${what}: ${tries} tries`)
}
