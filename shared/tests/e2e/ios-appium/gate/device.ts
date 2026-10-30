// Simulator-side actions a flow takes at the app's boundary, each with a deadline. A relaunch starts
// a new JS runtime: it checkpoints the attempt's recording on both sides of the restart.
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
import {attemptToken, creditSurface, type AttemptToken} from './attempt.ts'
import {attemptRecording, recorders} from './recording.ts'

const PASTEBOARD_MS = 30_000
const RUNTIME_WAIT_MS = 120_000
const PRIVACY_KILL_MS = 15_000

export const openLink = (url: string) => {
  openUrl(url)
  creditSurface('deep-link')
}

// Delivering the payload is not the credit's proof: the caller asserts the app showed or handled it.
export const pushNotification = (payload: object) => {
  sendPush(payload)
  creditSurface('push-notification')
}

export const addPhotos = (paths: Array<string>) => {
  if (!paths.length) return
  simctl('addmedia', deviceUdid(), ...paths)
}

export const setLocation = (lat: number, lon: number) => {
  simctlSetLocation(lat, lon)
  creditSurface('location')
}

// The text goes over stdin, never the command line; never use these for a secret.
export const setPasteboard = (text: string) => {
  execFileSync('xcrun', ['simctl', 'pbcopy', deviceUdid()], {
    input: text,
    killSignal: 'SIGKILL',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: PASTEBOARD_MS,
  })
  creditSurface('pasteboard')
}

const runtimeId = async (): Promise<string | undefined> =>
  (await jsEval<string | null>(RUNTIME_BODY)) ?? undefined

const waitForRuntime = async (before: string | undefined) =>
  waitFor('the relaunched app to start a new JS runtime', async () => {
    const now = await runtimeId()
    return now && now !== before ? now : undefined
  }, {interval: 500, timeout: RUNTIME_WAIT_MS})

const launch = async (before: string | undefined) => {
  if (appPid() === undefined) simctl('launch', deviceUdid(), BUNDLE_ID)
  await waitForRuntime(before)
  await ensureErrorCapture()
  await attemptRecording().checkpoint()
}

// What the app logged so far goes with its runtime, so it is kept on the attempt for afterTest.
const keepErrors = async () => {
  const rec = recorders.get(attemptToken())
  if (!rec || appPid() === undefined) return
  try {
    rec.errorsBefore = [...(rec.errorsBefore ?? []), ...(await takeErrors())]
  } catch (e) {
    rec.captureError ??= `reading the app's errors before it restarted: ${e instanceof Error ? e.message : String(e)}`
  }
}

// Terminates and launches the app and waits for its new JS runtime, with error capture running on it.
export const relaunchApp = async () => {
  const before = await runtimeId().catch(() => undefined)
  await attemptRecording().checkpoint()
  await keepErrors()
  await terminateApp()
  await launch(before)
  creditSurface('relaunch')
}

// The app hung for good (hang.ts): its runtime answers no eval, so what it recorded since the last
// checkpoint is lost and reading its errors fails (keepErrors notes that on the attempt). It is
// killed and launched; the attempt's recording and error capture move to the new runtime.
export const relaunchHungApp = async () => {
  await keepErrors()
  await terminateApp()
  await launch(undefined)
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

const backgrounded = new WeakSet<AttemptToken>()

export const toBackground = async () => {
  await backgroundApp()
  backgrounded.add(attemptToken())
}

// The credit is for a background that this attempt followed with a foreground.
export const toForeground = async () => {
  await activateApp()
  const token = attemptToken()
  if (backgrounded.delete(token)) creditSurface('background-foreground')
}
