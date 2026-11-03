// Simulator-side actions a flow takes at the app's boundary, each with a deadline. A relaunch starts
// a new JS runtime: it checkpoints the attempt's recording on both sides of the restart.
// Delivering something to the app proves nothing about it, so these credit nothing: a flow credits
// the surface (attempt.ts) once it has asserted the app used what was delivered, and device.test.ts
// keeps any credit call out of this file.
// What changes the phone beyond the app (its permissions, photo library and location) runs only
// against the udid preflight proved booted (KB_IOS_UDID), and names keybase.ios where simctl takes
// a bundle id.
import {execFileSync} from 'child_process'
import {createHash, randomBytes} from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {runSync} from '../helpers/app'
import {activateApp, appDataContainer, appPid, appState, backgroundApp, BUNDLE_ID, deviceUdid, FOREGROUND, jsEval, lookFor, openUrl, simctl, terminateApp, waitFor} from '../helpers/lifecycle'
import {CORPUS, corpusEntry} from '../../fixtures/corpus/corpus.ts'
import {e2eRunId} from '../../shared/run-marker.ts'
import {installAppLogCapture} from './app-log.ts'
import {RUNTIME_BODY} from '../../shared/phone-recorder.ts'
import {ensureErrorCapture, takeErrors} from './errors.ts'
import {openAttemptToken, requireCurrentAttempt} from './attempt.ts'
import {isAttemptOver} from './attempt-binding-lib.ts'
import {attemptRecording, openAttemptRecording, recorders} from './recording.ts'
import {
  chatNewMessagePayload,
  corpusToAdd,
  parseLocationd,
  parseTcc,
  privacyGrantArgs,
  privacyOriginal,
  privacyRestoreArgs,
  requireUdid,
  restorePrivacyWith,
  type PrivacyRestore,
  type PrivacyService,
  type PrivacySnapshot,
  type PushTarget,
} from './device-lib.ts'
import {requireFixedPoint, type Point} from './location-lib.ts'
import {readCorpusRecord, recordCorpusItem} from './photo-corpus.ts'
import {simulatorDataBirth} from './sim-data.ts'
import {PICKER_CACHES, pickedFilePath, type PickerCache} from './picker-lib.ts'
import {parseStampedName} from '../../accounts/run-id.ts'
import {APP_POISON, clearGatePoison, guarded, poisonGate} from './poison-lib.ts'
import {withHarnessRpcs} from './recorder.ts'
import {withDeadline} from '../../shared/deadline.ts'
import {pasteboardHolds} from './pasteboard-lib.ts'
import {WaitStopped} from './wait-lib.ts'

const PASTEBOARD_MS = 30_000
const PUSH_MS = 30_000
const TCC_MS = 15_000
const RUNTIME_WAIT_MS = 120_000
const PRIVACY_KILL_MS = 15_000
// locationd writes clients.plist on its own schedule after a reset
const RESTORE_READ_BACK_MS = 5_000
// a link or a tapped notification has iOS start the app within seconds
const DELIVERED_LAUNCH_MS = 30_000
const E2E_TMP = '/tmp/kb-e2e'

// The simulator preflight proved booted.
export const preflightUdid = () => requireUdid(process.env['KB_IOS_UDID'])

const execFailure = (what: string, e: unknown) => {
  const {signal, status} = e as {signal?: string | null; status?: number | null}
  return `${what} failed (${signal ? `signal ${signal}` : `exit ${status ?? '?'}`})`
}

// Hands the app `url` as the OS does. A link can name an account, a team or a folder, so a failure
// names neither the link nor the command line. The flow credits 'deep-link' once it has asserted the
// screen the app routed the link to.
export const openLink = (url: string) => {
  try {
    openUrl(url)
  } catch (e) {
    if (isAttemptOver(e)) throw e
    // no cause: the error holds the command line
    // eslint-disable-next-line preserve-caught-error
    throw new Error(execFailure('simctl openurl', e))
  }
}

let pushes = 0

// Delivers the chat.newmessage push for `target` (device-lib.ts chatNewMessagePayload) through a mode
// 600 file under /tmp/kb-e2e, removed after. A failure names neither the file nor the command line. The flow
// credits 'push-notification' once it has asserted the app showed or handled it.
export const pushNotification = (target: PushTarget) => {
  requireCurrentAttempt()
  const body = JSON.stringify(chatNewMessagePayload(target))
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

// Moves the simulator to `p`, one of the fixed public points (location-lib.ts); any other is refused
// before simctl runs. The flow credits 'location' once it has asserted the app used the location.
export const setLocation = (p: Point) => {
  const {lat, lon} = requireFixedPoint(p)
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

// -- the document picker's seed folder and the picked files ----------------------------------------

export const FILES_APP = 'com.apple.DocumentsApp'

// The folder of app group `group` that `bundleId` holds on this simulator, if it holds one.
export const groupContainer = (bundleId: string, group: string) => {
  const line = simctl('get_app_container', preflightUdid(), bundleId, 'groups')
    .split('\n')
    .find(l => l.startsWith(`${group}\t`))
  return line?.slice(group.length + 1).trim()
}

// The Files app's "On My iPhone" storage on this simulator.
const onMyIPhone = () => {
  const dir = groupContainer(FILES_APP, 'group.com.apple.FileProvider.LocalStorage')
  if (!dir) throw new Error("the simulator has no Files app storage (On My iPhone)")
  return path.join(dir, 'File Provider Storage')
}

// A folder of this run in On My iPhone, e2e-<runid>-<label>.
const requireSeedFolder = (folder: string) => {
  if (parseStampedName(folder, 'dashed')?.runId !== e2eRunId() || !/^[A-Za-z0-9-]+$/.test(folder)) {
    throw new Error('refusing a seed folder that is not one of this run')
  }
  return path.join(onMyIPhone(), folder)
}

// The file system's own error names the simulator's container path, and with it the host's home
// directory: say only what failed and its code.
const quietFs = <R,>(what: string, f: () => R): R => {
  try {
    return f()
  } catch (e) {
    const code = (e as {code?: string}).code ?? 'error'
    // no cause: the error holds the path
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`${what} failed (${code})`)
  }
}

// Where each seed folder this run made is, kept so a removal cut off by its attempt's end (which
// refuses the container lookup) can still read whether the folder is gone.
const seededDirs = new Map<string, string>()

// Makes a new folder of this run in On My iPhone (e2e-<runid>-<label>-<hex>, so a retry has its own)
// holding the corpus files `names`, for the document picker to pick from. The flow's afterEach removes
// it (removeSeedFolder); one that failed part way is removed here.
export const seedDocumentFolder = (label: string, names: ReadonlyArray<string>) => {
  requireCurrentAttempt()
  const folder = `e2e-${e2eRunId()}-${label}-${randomBytes(2).toString('hex')}`
  const dir = requireSeedFolder(folder)
  const files = names.map(corpusEntry)
  quietFs('making the seed folder', () => fs.mkdirSync(dir))
  seededDirs.set(folder, dir)
  try {
    for (const c of files) quietFs('seeding a corpus file', () => fs.copyFileSync(c.file, path.join(dir, c.name)))
  } catch (e) {
    quietFs('removing a part-seeded folder', () => fs.rmSync(dir, {force: true, recursive: true}))
    throw e
  }
  return folder
}

// The path of a seed folder of this run in On My iPhone, for the link the Files app opens it by.
export const seedFolderPath = (folder: string) => requireSeedFolder(folder)

// Removes a seed folder of this run and reads back that it is gone; one already gone is left be. A
// folder left there poisons the gate (every later document picker shows it), each folder under its
// own name, as a retry seeds its own; a removal that lands clears that. One that did not finish
// poisons only when the folder is still there, or when where it is was never known.
export const removeSeedFolder = async (folder: string) =>
  guarded(
    `the seed folder ${folder} in On My iPhone`,
    `remove the folder ${folder} from the Files app's On My iPhone on the simulator`,
    () => {
      const dir = requireSeedFolder(folder)
      quietFs('removing the seed folder', () => fs.rmSync(dir, {force: true, recursive: true}))
      if (fs.existsSync(dir)) throw new Error('a seed folder is still in On My iPhone after its removal')
      seededDirs.delete(folder)
    },
    () => {
      const dir = seededDirs.get(folder)
      if (dir === undefined) throw new Error('where the seed folder is was never known')
      return fs.existsSync(dir)
    }
  )

export type PickedFile = {path: string; sha256: string; size: number}

// What the app was handed by a picker: the file:// urls a titles screen (or an upload) holds, each a
// file in the app's picker caches (picker-lib.ts pickedFilePath), with its sha256 and size.
export const pickedFiles = (urls: ReadonlyArray<string>): Array<PickedFile> => {
  requireCurrentAttempt()
  const container = appData()
  return urls.map(u => readPicked(pickedFilePath(u, container)))
}

// The file `name` (an upload's leaf: the picker names its copy, and the upload keeps the name) in the
// app's `cache` picker cache.
export const pickerCacheFile = (cache: PickerCache, name: string): PickedFile => {
  requireCurrentAttempt()
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(name)) throw new Error('refusing a picked file name that is not plain')
  const container = appData()
  return readPicked(pickedFilePath(`file://${path.join(container, PICKER_CACHES[cache], name)}`, container))
}

// The image the app wrote for a paste into the composer (Kb.mm handlePastedImages: the app's tmp
// dir, paste_<uuid>.<ext>), as a titles screen holds it, with its sha256 and size.
export const pastedImage = (p: string): PickedFile => {
  requireCurrentAttempt()
  const local = p.startsWith('file://') ? p.slice('file://'.length) : p
  const dir = path.join(appData(), 'tmp')
  if (path.dirname(local) !== dir || !/^paste_[0-9A-F-]{36}\.[a-z0-9]{2,5}$/i.test(path.basename(local))) {
    throw new Error("a pasted image is not a paste file in the app's tmp dir")
  }
  return readPicked(local)
}

const appData = () => appDataContainer(preflightUdid())

const readPicked = (p: string): PickedFile => {
  const data = quietFs('reading a picked file', () => fs.readFileSync(p))
  return {path: p, sha256: createHash('sha256').update(data).digest('hex'), size: data.length}
}

// An image file's format as its bytes say (sips reads the file, not its name: "png", "jpeg", "heic")
// and its pixel size ("<w>x<h>"): how a re-encoded copy (the photo picker's for an upload, the app's
// compressed send) is matched to its corpus item. Bound: 15.
export const imageProps = (file: string) => {
  requireCurrentAttempt()
  const out = runSync('sips', ['-g', 'format', '-g', 'pixelWidth', '-g', 'pixelHeight', file], 15_000, {hidden: [file], what: 'sips'})
  // sips prints the path first, so each value is read only off its own indented key line
  const format = /^\s+format: (\S+)$/m.exec(out)?.[1]
  const w = /^\s+pixelWidth: (\d+)$/m.exec(out)?.[1]
  const h = /^\s+pixelHeight: (\d+)$/m.exec(out)?.[1]
  if (!format || !w || !h) throw new Error('sips read no format or pixel size')
  return {format, pixels: `${w}x${h}`}
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

// `alive` runs after each runtime read and throws a WaitStopped to stop the wait (an app that must
// not be launched again exited).
const waitForRuntime = async (before: string | undefined, alive?: () => void) =>
  waitFor('the relaunched app to start a new JS runtime', async () => {
    const now = await runtimeId()
    alive?.()
    return now && now !== before ? now : undefined
  }, {interval: 500, timeout: RUNTIME_WAIT_MS})

// The new runtime's error capture and app-log capture.
const captured = async (before: string | undefined, alive?: () => void) => {
  await waitForRuntime(before, alive)
  await ensureErrorCapture()
  await installAppLogCapture()
}

// The new runtime's captures and the attempt's recording.
const started = async (before: string | undefined, alive?: () => void) => {
  await captured(before, alive)
  await attemptRecording().checkpoint()
}

const launchIfNotRunning = () => {
  if (appPid() === undefined) simctl('launch', deviceUdid(), BUNDLE_ID)
}

const launch = async (before: string | undefined) => {
  launchIfNotRunning()
  await started(before)
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

// Before something restarts the app: its runtime id (to tell the new one by), the attempt's recording
// so far, and what it logged so far.
const beforeRestart = async () => {
  const before = await runtimeId().catch(() => undefined)
  await attemptRecording().checkpoint()
  await keepErrors()
  return before
}

// Terminates and launches the app and waits for its new JS runtime, with error capture running on it.
// `whileDown` runs once the app has exited, before it is launched (a mark on a log the next process
// writes). The flow credits 'relaunch' once it has asserted what the app shows after it.
export const relaunchApp = async ({whileDown}: {whileDown?: () => void} = {}) => {
  const before = await beforeRestart()
  await terminateApp()
  whileDown?.()
  await launch(before)
}

// The app's JS runtime id (a reload makes a new one under the same process), or undefined while it
// answers none. A read: credits nothing.
export const appRuntime = async () => runtimeId()

// Terminates the app, then has `deliver` launch it the way a person would (a link it opens, a
// notification tapped), and waits for its new JS runtime with error capture, the app-log capture and
// the recording on it. It never launches the app itself: an app that `deliver` did not start within
// DELIVERED_LAUNCH_MS, or that exits again before its runtime starts, fails, so what the app shows
// next is what `deliver` opened. The flow credits
// 'relaunch' (and the surface `deliver` used) once it has asserted that screen.
export const launchedBy = async (deliver: () => unknown) => {
  const before = await beforeRestart()
  await terminateApp()
  await deliver()
  await waitFor('the app to launch from what was delivered', () => (appPid() === undefined ? undefined : true), {
    interval: 500,
    timeout: DELIVERED_LAUNCH_MS,
  })
  await started(before, () => {
    if (appPid() === undefined) throw new WaitStopped('the app exited after what was delivered launched it')
  })
}

const FRONT_MS = 30_000

// For a flow's afterEach (simctl, Appium's activate and reads only; no recording): an app a test left
// terminated is launched, one it left in the background is brought to the front, and either way this
// waits for it in front with its JS runtime up, so the next test's reset finds it. An app that does
// not come back poisons the gate; one that does clears that poison.
export const launchIfGone = async () => {
  try {
    const udid = preflightUdid()
    if (appPid(udid) === undefined) simctl('launch', udid, BUNDLE_ID)
    else if ((await appState()) !== FOREGROUND) await activateApp()
    await waitFor('the app in front', async () => ((await appState()) === FOREGROUND ? true : undefined), {interval: 500, timeout: FRONT_MS})
    // a launch that has a pid may not have started its runtime yet
    await waitFor('the app to have its JS runtime', async () => ((await runtimeId()) ? true : undefined), {
      interval: 500,
      timeout: RUNTIME_WAIT_MS,
    })
  } catch (e) {
    if (isAttemptOver(e)) throw e
    poisonGate(APP_POISON, 'bring the Keybase app to the front on the simulator and check it shows the smoke account')
    throw new Error(`bringing ${APP_POISON} back failed: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
  clearGatePoison(APP_POISON)
}

// The app hung for good (hang.ts) or is gone (crash.ts): a hung runtime answers no eval, so what it
// recorded since the last checkpoint is lost and reading its errors fails (keepErrors notes that on
// the attempt). It is killed and launched; the open attempt's recording and error capture move to the
// new runtime. Between attempts, or in one whose recorder never started, there is no recording to move.
export const relaunchHungApp = async () => {
  await keepErrors()
  await terminateApp()
  launchIfNotRunning()
  await captured(undefined)
  await openAttemptRecording()?.checkpoint()
}

// The app's permissions, read only: its rows in the simulator's TCC.db, and its location
// authorization in locationd's clients.plist (TCC does not keep location). A simulator whose locationd
// has no clients.plist yet has never asked any app.
export const privacySnapshot = (udid: string): PrivacySnapshot => {
  requireCurrentAttempt()
  const data = path.join(os.homedir(), 'Library/Developer/CoreSimulator/Devices', requireUdid(udid), 'data/Library')
  const tcc = parseTcc(runSync('sqlite3', ['-readonly', '-json', path.join(data, 'TCC/TCC.db'), `SELECT service, auth_value FROM access WHERE client = '${BUNDLE_ID}'`], TCC_MS))
  const clients = path.join(data, 'Caches/locationd/clients.plist')
  let xml: string
  try {
    xml = runSync('plutil', ['-convert', 'xml1', '-o', '-', clients], TCC_MS)
  } catch (e) {
    if (!fs.existsSync(clients)) return {locationAuth: undefined, tcc}
    throw e
  }
  return {locationAuth: parseLocationd(xml), tcc}
}

// The permissions whose simctl grant or reset terminates the app (on iOS 26.5, within a second, even
// one already granted); no location change does.
const KILLED_BY: ReadonlySet<PrivacyService> = new Set(['photos', 'photos-add'])

// Whether the app exited, or came back with a JS runtime other than `before`, within PRIVACY_KILL_MS
// of a permission change (iOS restarts a process whose permission changes).
const privacyKilledApp = async (before: string | undefined) =>
  !!(await lookFor(
    async () => {
      if (appPid() === undefined) return true
      const now = await runtimeId().catch(() => undefined)
      return now !== undefined && now !== before ? true : undefined
    },
    {interval: 500, timeout: PRIVACY_KILL_MS}
  ))

// Grants keybase.ios `service` and returns what restorePrivacy puts back, read first (a
// permission this could not put back is refused before anything changes). simctl privacy can
// terminate the app (iOS restarts a process whose permission changes): on iOS 26.5 every photos and
// photos-add grant or reset kills it within a second, even one already granted, and no location
// change does. When the app exited or came back with a new JS runtime within
// PRIVACY_KILL_MS, it is launched if gone and this waits for its new runtime, so a body runs it,
// never a hook.
export const grantPrivacy = async (service: PrivacyService): Promise<PrivacyRestore> => {
  const udid = preflightUdid()
  const original = privacyOriginal(privacySnapshot(udid), service)
  const restore = privacyRestoreArgs(original, service, udid)
  const grant = privacyGrantArgs(service, udid, BUNDLE_ID)
  const before = await beforeRestart()
  // from the grant until the token is handed back, a failure leaves the permission changed with no
  // token to put it back: the gate stays poisoned, naming the restore (restorePrivacy's own name, so
  // a later restore of it clears this too)
  const what = `the ${service} permission for ${BUNDLE_ID}`
  poisonGate(what, `run xcrun simctl ${restore.join(' ')}`)
  simctl(...grant)
  if ((await privacyKilledApp(before)) || appPid() === undefined) await launch(before)
  clearGatePoison(what)
  return {done: false, original, udid}
}

// Puts back what grantPrivacy changed, once (device-lib.ts restorePrivacyWith): for a flow's
// afterEach, as simctl and reads are all it runs. A photos restore that ran then waits out the kill
// it brings (grantPrivacy), so the afterEach's launchIfGone after it does not find the app still up
// and then lose it. It never launches the app. A restore that fails poisons the gate. Bound: the
// runtime 1 (a photos service), the TCC read 15, simctl 120, the read-back 5s overrun by one read 15,
// the kill watch 15 overrun by one pid read 120 (a photos service) = 291; location's 155.
export const restorePrivacy = async (r: PrivacyRestore) => {
  const kills = KILLED_BY.has(r.original.service)
  const before = kills ? await runtimeId().catch(() => undefined) : undefined
  const ran = await restorePrivacyWith(r, {
    read: () => privacySnapshot(r.udid),
    readBack: async taken => (await lookFor(() => (taken() ? true : undefined), {interval: 500, timeout: RESTORE_READ_BACK_MS})) ?? false,
    run: args => void simctl(...args),
  })
  if (ran && kills) await privacyKilledApp(before)
}

export const toBackground = async () => backgroundApp()

export const toForeground = async () => activateApp()
