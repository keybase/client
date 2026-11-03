// Simulator-side actions a flow takes at the app's boundary, each with a deadline. A relaunch starts
// a new JS runtime: it checkpoints the attempt's recording on both sides of the restart.
// Delivering something to the app proves nothing about it, so these credit nothing: a flow calls
// creditSurface(<surface>) once it has asserted the app used what was delivered.
import {
  activateApp,
  appPid,
  backgroundApp,
  BUNDLE_ID,
  deviceUdid,
  jsEval,
  openUrl,
  sendPush,
  setLocation as simctlSetLocation,
  simctl,
  terminateApp,
  waitFor,
} from '../helpers/lifecycle'
import {RUNTIME_BODY} from '../../shared/phone-recorder.ts'
import {ensureErrorCapture, takeErrors} from './errors.ts'
import {openAttemptToken, requireCurrentAttempt} from './attempt.ts'
import {attemptRecording, openAttemptRecording, recorders} from './recording.ts'
import {withHarnessRpcs} from './recorder.ts'
import {withDeadline} from '../../shared/deadline.ts'
import {pasteboardHolds} from './pasteboard-lib.ts'

const PASTEBOARD_MS = 30_000
const RUNTIME_WAIT_MS = 120_000
const PRIVACY_KILL_MS = 15_000

// The flow credits 'deep-link' once it has asserted the screen the app routed the link to.
export const openLink = (url: string) => openUrl(url)

// The flow credits 'push-notification' once it has asserted the app showed or handled it.
export const pushNotification = (payload: object) => sendPush(payload)

export const addPhotos = (paths: Array<string>) => {
  if (!paths.length) return
  simctl('addmedia', deviceUdid(), ...paths)
}

// The flow credits 'location' once it has asserted the app used the location.
export const setLocation = (lat: number, lon: number) => simctlSetLocation(lat, lon)

// Puts `text` on the simulator's pasteboard and reads it back. Writes from outside the simulator
// (`simctl pbcopy`, WDA's mobile: setPasteboard) leave it empty on this host's simulators, so the app's
// own clipboard module writes it, over Metro (it sends no RPC; the recorder is paused all the same).
// A secret goes on it only as the way into the app's own Paste (an invite link), and the flow
// overwrites it once the app has it. The flow credits 'pasteboard' once it has asserted the pasted
// text landed in the app. Bound: the write 30, its outcome 10, its read back 10 = 50s.
export const setPasteboard = async (text: string) => {
  // an eval body runs synchronously, so the write's promise settles into a global the harness polls;
  // its outcome holds no text, and a failure says only that the write failed
  await withHarnessRpcs('the pasteboard write', async () => {
    await jsEval(`
      const g = globalThis
      g.__e2ePasteboard = 'pending'
      Promise.resolve()
        .then(() => kbModule('node_modules/expo-clipboard/build/Clipboard.js').setStringAsync(${JSON.stringify(text)}))
        .then(ok => { g.__e2ePasteboard = ok === false ? 'refused' : 'ok' }, () => { g.__e2ePasteboard = 'failed' })
      return true
    `)
    const outcome = await waitFor(
      'the app to finish the pasteboard write',
      async () => {
        const o = await jsEval<string | null>('return globalThis.__e2ePasteboard ?? null')
        return o && o !== 'pending' ? o : undefined
      },
      {interval: 200, timeout: 10_000}
    )
    if (outcome !== 'ok') throw new Error(`the app's clipboard write ${outcome === 'refused' ? 'was refused' : 'failed'}`)
  })
  await waitFor(
    'the pasteboard to hold the text',
    async () => pasteboardHolds(async () => browser.execute<string, [{encoding: string}]>('mobile: getPasteboard', {encoding: 'base64'}), text),
    {interval: 500, timeout: 10_000}
  )
}

// The simulator's pasteboard text (what the app copied), read through WDA's mobile: getPasteboard
// (setPasteboard's reader: `simctl pbpaste` does not see the app's pasteboard on this host). The value
// is the caller's to compare and is never logged: a failed read says only that it failed. The flow
// credits 'pasteboard' once it has asserted the text is what the app copied. Bound: 30s.
export const pasteboardText = async (): Promise<string> => {
  requireCurrentAttempt()
  let got: string
  try {
    got = await withDeadline(
      browser.execute<string, [{encoding: string}]>('mobile: getPasteboard', {encoding: 'base64'}),
      PASTEBOARD_MS,
      'reading the simulator pasteboard'
    )
  } catch (e) {
    // no cause, and only a deadline's own message: a WebDriver error may echo what it read
    const late = e instanceof Error && e.message.startsWith('reading the simulator pasteboard: no answer')
    // eslint-disable-next-line preserve-caught-error
    throw new Error(late ? e.message : 'reading the simulator pasteboard failed')
  }
  // a body mocha abandoned while the read ran does not go on with what it read
  requireCurrentAttempt()
  return Buffer.from(got, 'base64').toString('utf8')
}

const runtimeId = async (): Promise<string | undefined> =>
  (await jsEval<string | null>(RUNTIME_BODY)) ?? undefined

const waitForRuntime = async (before: string | undefined) =>
  waitFor('the relaunched app to start a new JS runtime', async () => {
    const now = await runtimeId()
    return now && now !== before ? now : undefined
  }, {interval: 500, timeout: RUNTIME_WAIT_MS})

const startedAgain = async (before: string | undefined) => {
  if (appPid() === undefined) simctl('launch', deviceUdid(), BUNDLE_ID)
  await waitForRuntime(before)
  await ensureErrorCapture()
}

const launch = async (before: string | undefined) => {
  await startedAgain(before)
  await attemptRecording().checkpoint()
}

// What the app logged so far goes with its runtime, so it is kept on the attempt for afterTest.
const keepErrors = async () => {
  const token = openAttemptToken()
  const rec = token && recorders.get(token)
  if (!rec || appPid() === undefined) return
  try {
    rec.errorsBefore = [...(rec.errorsBefore ?? []), ...(await takeErrors())]
  } catch (e) {
    rec.captureError ??= `reading the app's errors before it restarted: ${e instanceof Error ? e.message : String(e)}`
  }
}

// Terminates and launches the app and waits for its new JS runtime, with error capture running on it.
// The flow credits 'relaunch' once it has asserted what the app shows after it.
export const relaunchApp = async () => {
  const before = await runtimeId().catch(() => undefined)
  await attemptRecording().checkpoint()
  await keepErrors()
  await terminateApp()
  await launch(before)
}

// The app hung for good (hang.ts) or is gone (crash.ts): a hung runtime answers no eval, so what it
// recorded since the last checkpoint is lost and reading its errors fails (keepErrors notes that on
// the attempt). It is killed and launched; the open attempt's recording and error capture move to the
// new runtime. Between attempts, or in one whose recorder never started, there is no recording to move.
export const relaunchHungApp = async () => {
  await keepErrors()
  await terminateApp()
  await startedAgain(undefined)
  await openAttemptRecording()?.checkpoint()
}

// simctl privacy can terminate the app (iOS restarts a process whose permission changes), and the
// kill can land seconds after the grant returns. When the app exited or came back with a new JS
// runtime within PRIVACY_KILL_MS, it is launched if gone and this waits for its new runtime.
export const grantPrivacy = async (service: string) => {
  const before = await runtimeId().catch(() => undefined)
  await attemptRecording().checkpoint()
  await keepErrors()
  simctl('privacy', deviceUdid(), 'grant', service, BUNDLE_ID)
  const changed = await waitFor(
    'the app to exit or start a new JS runtime',
    async () => {
      if (appPid() === undefined) return true
      const now = await runtimeId().catch(() => undefined)
      return now !== undefined && now !== before ? true : undefined
    },
    {interval: 500, timeout: PRIVACY_KILL_MS}
  ).catch(() => false)
  if (changed || appPid() === undefined) await launch(before)
}

export const toBackground = async () => backgroundApp()

export const toForeground = async () => activateApp()
