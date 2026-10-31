// Simulator-side actions a flow takes at the app's boundary, each with a deadline. A relaunch starts
// a new JS runtime: it checkpoints the attempt's recording on both sides of the restart.
// Delivering something to the app proves nothing about it, so these credit nothing: a flow credits
// the surface (attempt.ts) once it has asserted the app used what was delivered, and device.test.ts
// keeps any credit call out of this file.
// What changes the phone beyond the app (its permissions, photo library and location) runs only
// against the udid preflight proved booted (KB_IOS_UDID), and names keybase.ios where simctl takes
// a bundle id.
import {execFileSync} from 'child_process'
import {createHash} from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {runSync} from '../helpers/app'
import {activateApp, appPid, backgroundApp, BUNDLE_ID, deviceUdid, jsEval, lookFor, openUrl, simctl, terminateApp, waitFor} from '../helpers/lifecycle'
import {CORPUS} from '../../fixtures/corpus/corpus.ts'
import {e2eRunId} from '../../shared/run-marker.ts'
import {installAppLogCapture} from './app-log.ts'
import {RUNTIME_BODY} from '../../shared/phone-recorder.ts'
import {ensureErrorCapture, takeErrors} from './errors.ts'
import {openAttemptToken, requireCurrentAttempt} from './attempt.ts'
import {attemptRecording, openAttemptRecording, recorders} from './recording.ts'
import {
  corpusToAdd,
  parseTcc,
  privacyGrantArgs,
  privacyOriginal,
  privacyRestoreArgs,
  requireTappablePush,
  requireUdid,
  restorePrivacyWith,
  type PrivacyRestore,
  type PrivacyService,
  type PushPayload,
  type TccRow,
} from './device-lib.ts'
import {readCorpusRecord, recordCorpusItem} from './photo-corpus.ts'
import {simulatorDataBirth} from './sim-data.ts'
import {clearGatePoison, poisonGate} from './poison-lib.ts'
import {withHarnessRpcs} from './recorder.ts'
import {withDeadline} from '../../shared/deadline.ts'
import {pasteboardHolds} from './pasteboard-lib.ts'

const PASTEBOARD_MS = 30_000
const PUSH_MS = 30_000
const TCC_MS = 15_000
const RUNTIME_WAIT_MS = 120_000
const PRIVACY_KILL_MS = 15_000
const E2E_TMP = '/tmp/kb-e2e'

// The simulator preflight proved booted.
const preflightUdid = () => requireUdid(process.env['KB_IOS_UDID'])

const execFailure = (what: string, e: unknown) => {
  const {signal, status} = e as {signal?: string | null; status?: number | null}
  return `${what} failed (${signal ? `signal ${signal}` : `exit ${status ?? '?'}`})`
}

// The flow credits 'deep-link' once it has asserted the screen the app routed the link to.
export const openLink = (url: string) => openUrl(url)

let pushes = 0

// Delivers a chat.newmessage push (device-lib.ts chatNewMessagePayload) through a mode 600 file
// under /tmp/kb-e2e, removed after. A failure names neither the file nor the command line. The flow
// credits 'push-notification' once it has asserted the app showed or handled it.
export const pushNotification = (payload: PushPayload) => {
  requireCurrentAttempt()
  const body = JSON.stringify(requireTappablePush(payload))
  const udid = preflightUdid()
  fs.mkdirSync(E2E_TMP, {mode: 0o700, recursive: true})
  const file = path.join(E2E_TMP, `push-${e2eRunId()}-${++pushes}.json`)
  try {
    fs.rmSync(file, {force: true})
    fs.writeFileSync(file, body, {flag: 'wx', mode: 0o600})
    execFileSync('xcrun', ['simctl', 'push', udid, BUNDLE_ID, file], {killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'], timeout: PUSH_MS})
  } catch (e) {
    // no cause: the error holds the command line
    // eslint-disable-next-line preserve-caught-error
    throw new Error(execFailure('simctl push', e))
  } finally {
    fs.rmSync(file, {force: true})
  }
}

// The flow credits 'location' once it has asserted the app used the location.
export const setLocation = (lat: number, lon: number) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('refusing a location that is not two numbers')
  simctl('location', preflightUdid(), 'set', `${lat},${lon}`)
}

const LOCATION = 'the simulated location'

// Clears the simulated location (a restore: simctl only, so a hook can run it). A clear that fails
// poisons the gate, naming the call to run by hand; one that works clears that poison.
export const clearLocation = () => {
  const udid = preflightUdid()
  try {
    simctl('location', udid, 'clear')
  } catch (e) {
    poisonGate(LOCATION, `run xcrun simctl location ${udid} clear`)
    throw new Error(`clearing ${LOCATION} failed: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
  clearGatePoison(LOCATION)
}

// -- the photo corpus ------------------------------------------------------------------------------

export type CorpusItem = {file: string; kind: 'image' | 'video'; name: string; sha256: string}

const photoCorpus = (): Array<CorpusItem> =>
  CORPUS.flatMap(c =>
    c.kind === 'image' || c.kind === 'video'
      ? [{file: c.file, kind: c.kind, name: c.name, sha256: createHash('sha256').update(fs.readFileSync(c.file)).digest('hex')}]
      : []
  )

// The corpus's photos and videos, each added to this simulator's library once ever: the library
// can't be cleaned through simctl, so it grows by the corpus and nothing else. What was added is
// recorded (udid, the simulator data's identity and sha256) in ~/.config/keybase-e2e/ios-photo-corpus.json,
// mode 600, one item at a time after its addmedia; an erase gives the data a new identity, so the
// corpus goes in again. Each goes in from a mode 600 copy under /tmp/kb-e2e/media-<runid>, removed
// after. A flow picks an item and proves what it picked by read-back, never by grid position.
export const ensurePhotoCorpus = async (): Promise<Array<CorpusItem>> => {
  requireCurrentAttempt()
  const udid = preflightUdid()
  const wanted = photoCorpus()
  // an erased simulator's data is new, and its library is empty again
  const data = simulatorDataBirth(udid)
  const missing = corpusToAdd(readCorpusRecord()[udid], data, wanted)
  if (missing.length) {
    const dir = path.join(E2E_TMP, `media-${e2eRunId()}`)
    fs.mkdirSync(dir, {mode: 0o700, recursive: true})
    try {
      for (const item of missing) {
        const copy = path.join(dir, item.name)
        fs.copyFileSync(item.file, copy)
        fs.chmodSync(copy, 0o600)
        try {
          simctl('addmedia', udid, copy)
        } finally {
          fs.rmSync(copy, {force: true})
        }
        recordCorpusItem(udid, data, {name: item.name, sha256: item.sha256})
      }
    } finally {
      fs.rmSync(dir, {force: true, recursive: true})
    }
  }
  return Promise.resolve(wanted)
}

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
  await installAppLogCapture()
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

// The app's rows in the simulator's TCC.db (its permissions but location), read only.
export const tccSnapshot = (udid: string): Array<TccRow> => {
  requireCurrentAttempt()
  const db = path.join(os.homedir(), 'Library/Developer/CoreSimulator/Devices', requireUdid(udid), 'data/Library/TCC/TCC.db')
  return parseTcc(runSync('sqlite3', ['-readonly', '-json', db, `SELECT service, auth_value FROM access WHERE client = '${BUNDLE_ID}'`], TCC_MS))
}

// Grants keybase.ios `service` and returns what restorePrivacy puts back, read from TCC.db first (a
// permission this could not put back is refused before anything changes). simctl privacy can
// terminate the app (iOS restarts a process whose permission changes), and the kill can land seconds
// after the grant returns. When the app exited or came back with a new JS runtime within
// PRIVACY_KILL_MS, it is launched if gone and this waits for its new runtime, so a body runs it,
// never a hook.
export const grantPrivacy = async (service: PrivacyService): Promise<PrivacyRestore> => {
  const udid = preflightUdid()
  const original = privacyOriginal(tccSnapshot(udid), service)
  privacyRestoreArgs(original, service, udid)
  const grant = privacyGrantArgs(service, udid, BUNDLE_ID)
  const before = await runtimeId().catch(() => undefined)
  await attemptRecording().checkpoint()
  await keepErrors()
  simctl(...grant)
  const changed = await lookFor(
    async () => {
      if (appPid() === undefined) return true
      const now = await runtimeId().catch(() => undefined)
      return now !== undefined && now !== before ? true : undefined
    },
    {interval: 500, timeout: PRIVACY_KILL_MS}
  )
  if (changed || appPid() === undefined) await launch(before)
  return {done: false, original, udid}
}

// Puts back what grantPrivacy changed, once (device-lib.ts restorePrivacyWith): for a flow's
// afterEach, as simctl is all it runs. A restore that fails poisons the gate.
export const restorePrivacy = (r: PrivacyRestore) => {
  restorePrivacyWith(r, {read: () => tccSnapshot(r.udid), run: args => void simctl(...args)})
}

export const toBackground = async () => backgroundApp()

export const toForeground = async () => activateApp()
