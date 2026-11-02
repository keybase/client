// Simulator-side actions a flow takes at the app's boundary, each with a deadline. A relaunch starts
// a new JS runtime: it checkpoints the attempt's recording on both sides of the restart.
// Delivering something to the app proves nothing about it, so these credit nothing: a flow calls
// creditSurface(<surface>) once it has asserted the app used what was delivered.
import {execFileSync} from 'child_process'
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
import {openAttemptToken} from './attempt.ts'
import {attemptRecording, openAttemptRecording, recorders} from './recording.ts'

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

// The text goes over stdin, never the command line; never use these for a secret. The flow credits
// 'pasteboard' once it has asserted the pasted text landed in the app.
export const setPasteboard = (text: string) => {
  execFileSync('xcrun', ['simctl', 'pbcopy', deviceUdid()], {
    input: text,
    killSignal: 'SIGKILL',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: PASTEBOARD_MS,
  })
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
