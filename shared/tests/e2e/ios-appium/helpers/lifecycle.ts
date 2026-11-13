import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {hostAppPid, runSync, udidForName} from './app'
import * as T from '../../shared/test-ids'
import {evalInPage, inspectorPageFor} from '../../shared/metro-eval'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {pollFor} from '../gate/wait-lib.ts'
import {hiddenSimctlArgs} from '../gate/run-errors-lib'
import {sessionPingDue} from '../gate/hang-lib.ts'
import {harnessSite, timingOn, writeTiming} from '../../shared/gate/timing.ts'
import {requireCurrentAttempt} from '../gate/attempt'
import {appSnapshotBody} from '../gate/screen-params-lib.ts'
import {goLogIn, markFile, type LogMark} from '../gate/go-log-lib.ts'
import {waitForTestID} from './elements'
import {atTabs, escapeToTabs, navigateToChat} from './navigate'

// Lifecycle flows assert on state and logs, never on screenshots:
// - JS state is read from the running app through the Metro inspector (Runtime.evaluate).
// - Native and Go transitions come from the app container's Go log (ios.log).
// - Gate flows read JS log lines (logger.info/warn) through gate/app-log.ts's in-runtime capture.

export const BUNDLE_ID = 'keybase.ios'
// the app's executable inside Keybase.app (hostAppPid)
const APP_EXECUTABLE = 'Keybase'

export const deviceName = () => process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
export const deviceUdid = () => process.env['KB_IOS_UDID'] ?? udidForName(deviceName())

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Covers a log show over a long run and an addmedia of several videos; a cold boot gets longer.
const simctlMs = (args: ReadonlyArray<string>) => (args[0] === 'bootstatus' ? 300_000 : 120_000)

// Each of these refuses to run in a gate test body mocha timed out (gate/attempt.ts). A failure names
// the subcommand, never a link, path or name it was given (hiddenSimctlArgs).
export const simctl = (...args: Array<string>): string => {
  requireCurrentAttempt()
  const site = timingOn() ? harnessSite() : ''
  const start = Date.now()
  try {
    return runSync('xcrun', ['simctl', ...args], simctlMs(args), {what: `simctl ${args[0] ?? ''}`, hidden: hiddenSimctlArgs(args)})
  } finally {
    // only the subcommand: its arguments can name what a flow put on the phone
    if (timingOn()) writeTiming({end: Date.now(), kind: 'command', name: `simctl ${args[0] ?? ''}`, site, start})
  }
}

// Keeps the Appium session through a wait that sends it nothing (gate/hang-lib.ts sessionPingDue):
// outside a wdio session it does nothing.
let lastSessionPing = 0
const keepSession = async () => {
  if (typeof browser === 'undefined' || !browser.sessionId || !sessionPingDue(Date.now(), lastSessionPing)) return
  lastSessionPing = Date.now()
  await browser.getTimeouts()
}

// Retries until check returns a value, or throws with the last error once the timeout passes. A check
// throws gate/wait-lib.ts WaitStopped to end the wait at once.
export const waitFor = async <R>(
  what: string,
  check: () => Promise<R | undefined> | R | undefined,
  {timeout = 20000, interval = 250}: {timeout?: number; interval?: number} = {}
): Promise<R> =>
  pollFor(what, check, {interval, timeout}, {
    before: requireCurrentAttempt,
    now: Date.now,
    pause: async ms => {
      await keepSession()
      await sleep(ms)
    },
  })

// Polls check until it returns a value, or answers undefined once the timeout passes. An error check
// throws is thrown at once, so running out of time with nothing found is the only quiet outcome.
export const lookFor = async <R>(
  check: () => Promise<R | undefined> | R | undefined,
  {timeout, interval = 250}: {timeout: number; interval?: number}
): Promise<R | undefined> => {
  const end = Date.now() + timeout
  for (;;) {
    requireCurrentAttempt()
    const r = await check()
    if (r !== undefined) return r
    if (Date.now() > end) return undefined
    await keepSession()
    await sleep(interval)
  }
}

// undefined when nothing is at the path; any other failure throws
const statOrUndefined = (file: string) => fs.statSync(file, {throwIfNoEntry: false})

// -- app process ------------------------------------------------------------

// The pid of the running app on the simulator, or undefined when it isn't running.
export const appPid = (udid = deviceUdid()): number | undefined => {
  requireCurrentAttempt()
  return hostAppPid(udid, APP_EXECUTABLE)
}

export const terminateApp = async (udid = deviceUdid()) => {
  try {
    simctl('terminate', udid, BUNDLE_ID)
  } catch (e) {
    // an app that is not running fails to terminate; the wait below is what says it is gone
    if (isAttemptOver(e)) throw e
  }
  await waitFor('the app to exit', () => (appPid(udid) === undefined ? true : undefined), {timeout: 10000})
}

// Crash reports for the iOS app written after `since`. Simulator crashes land in the host's
// DiagnosticReports next to the host's own, including the desktop Keybase app's, so match on
// the bundle id in the report's JSON header line.
// A report written since `since` whose header can't be read throws, naming the report's file.
export const crashReportsSince = (since: number): Array<string> => {
  const dir = path.join(os.homedir(), 'Library/Logs/DiagnosticReports')
  if (!statOrUndefined(dir)) return []
  // a report removed between the listing and its read reads as none
  const headerOf = (file: string) => {
    try {
      return fs.readFileSync(file, 'utf8').split('\n', 1)[0] ?? ''
    } catch (e) {
      if ((e as {code?: string}).code === 'ENOENT') return undefined
      throw e
    }
  }
  const bundleOf = (file: string) => {
    const header = headerOf(file)
    if (header === undefined) return undefined
    try {
      return (JSON.parse(header) as {bundleID?: string}).bundleID
    } catch {
      throw new Error(`the crash report ${path.basename(file)} has no json header line`)
    }
  }
  return fs
    .readdirSync(dir)
    .filter(n => n.endsWith('.ips'))
    .map(n => path.join(dir, n))
    .filter(p => (statOrUndefined(p)?.mtimeMs ?? 0) >= since && bundleOf(p) === BUNDLE_ID)
}

// -- Metro inspector ----------------------------------------------------------

// Evaluates a synchronous function body in the app's JS runtime and returns its value.
// Only works against a debug build served by Metro.
export const jsEval = async <R>(body: string, device = deviceName()): Promise<R> => {
  const page = await inspectorPageFor(device, BUNDLE_ID)
  // after the page lookup's wait, just before the send
  requireCurrentAttempt()
  return evalInPage<R>(page, body)
}

export type AppSnapshot = {
  loggedIn: boolean
  mobileAppState: string
  httpSrv: {address: string; token: string}
  screen?: {name?: string; params?: Record<string, unknown>}
}

// JS app state (shell store, fed by the service's appState notification), the http
// server address JS uses for images, and the visible screen, its secret params left in the app
// (gate/screen-params-lib.ts).
export const appSnapshot = async (device = deviceName()) => jsEval<AppSnapshot>(appSnapshotBody, device)

// Waits for a relaunched JS runtime to be logged in and report `state`. There is only one
// derivation of it now, so there is no second value to agree with.
export const waitForAppState = async (state: string, device = deviceName(), timeout = 60000) =>
  waitFor(
    `JS app state ${state}`,
    async () => {
      const s = await appSnapshot(device)
      return s.loggedIn && s.mobileAppState === state && s.httpSrv.address ? s : undefined
    },
    {interval: 500, timeout}
  )

// -- avatars over the local http server --------------------------------------

// Fetches the smoke user's avatar from the app's local http server using the address and
// token JS currently holds, the same URL shape Go hands to image components.
export const fetchAvatar = async (httpSrv: {address: string; token: string}, username: string) => {
  const url = `http://${httpSrv.address}/av?typ=user&name=${encodeURIComponent(username)}&format=square_192&token=${httpSrv.token}`
  try {
    const res = await fetch(url, {signal: AbortSignal.timeout(5000)})
    const body = await res.arrayBuffer()
    return {bytes: body.byteLength, contentType: res.headers.get('content-type') ?? '', status: res.status}
  } catch (e) {
    return {bytes: 0, contentType: '', error: e instanceof Error ? e.message : String(e), status: 0}
  }
}

// Images load only once JS holds the running server's address; after a restart that can
// take a moment to arrive, so re-read it on each try.
export const waitForAvatar200 = async (username: string, device = deviceName(), timeout = 20000) =>
  waitFor(
    'the avatar to load from the local http server',
    async () => {
      const {httpSrv} = await appSnapshot(device)
      const r = await fetchAvatar(httpSrv, username)
      return r.status === 200 && r.bytes > 0 && r.contentType.startsWith('image/') ? {...r, httpSrv} : undefined
    },
    {interval: 500, timeout}
  )

// -- logs --------------------------------------------------------------------

// The app's data container (a path on this Mac). It moves on reinstall, so resolve it each time.
export const appDataContainer = (udid = deviceUdid()) => simctl('get_app_container', udid, BUNDLE_ID, 'data').trim()

// The Go service log inside the app's data container.
export const goLogPath = (udid = deviceUdid()) => goLogIn(appDataContainer(udid))

export const goLogMark = (udid = deviceUdid()): LogMark => markFile(goLogPath(udid))

// Waits until `read` yields a line matching every pattern, in order. Returns the matched lines.
export const waitForLinesInOrder = async (
  what: string,
  read: () => Array<string>,
  patterns: Array<RegExp>,
  timeout = 20000
) =>
  waitFor(
    what,
    () => {
      const lines = read()
      const matched: Array<string> = []
      let i = 0
      for (const re of patterns) {
        while (i < lines.length && !re.test(lines[i]!)) i++
        if (i === lines.length) return undefined
        matched.push(lines[i]!)
        i++
      }
      return matched
    },
    {interval: 500, timeout}
  )

// -- simulator actions -------------------------------------------------------

export const openUrl = (url: string, udid = deviceUdid()) => simctl('openurl', udid, url)

// -- app, springboard and chat actions -----------------------------------------

export const backgroundApp = async () => browser.execute('mobile: backgroundApp', {seconds: -1})

export const activateApp = async () => browser.execute('mobile: activateApp', {bundleId: BUNDLE_ID})

// The app's state as XCUITest reads it: 1 not running, 2 or 3 in the background, 4 (FOREGROUND) in
// the foreground.
export const FOREGROUND = 4
export const appState = async () => browser.execute<number, [{bundleId: string}]>('mobile: queryAppState', {bundleId: BUNDLE_ID})

// Runs fn with element lookups pointed at the home screen / system UI instead of the app.
export const withSpringboard = async <R>(fn: () => Promise<R>): Promise<R> => {
  await browser.updateSettings({defaultActiveApplication: 'com.apple.springboard'})
  try {
    return await fn()
  } finally {
    await browser.updateSettings({defaultActiveApplication: BUNDLE_ID})
  }
}

const labelContains = (text: string) => browser.$$(`-ios predicate string:label CONTAINS "${text}"`)

// Pulling down from the top-left edge opens Notification Center over the app, which
// deactivates its scene without backgrounding it (the same inactive state Control Center
// and system alerts cause).
export const openNotificationCenter = async () => {
  const {width, height} = await browser.getWindowRect()
  const x = Math.round(width * 0.3)
  await browser
    .action('pointer')
    .move({x, y: 2})
    .down()
    .move({x, y: Math.round(height * 0.6), duration: 400})
    .up()
    .perform()
}

export const closeNotificationCenter = async () => {
  const {width, height} = await browser.getWindowRect()
  const x = Math.round(width * 0.5)
  await browser
    .action('pointer')
    .move({x, y: height - 5})
    .down()
    .move({x, y: Math.round(height * 0.2), duration: 300})
    .up()
    .perform()
}

// The system UI element whose label contains `text` (a notification's button when it shows one, as
// the button takes the tap), once shown, or undefined after `timeout`. Run inside withSpringboard.
export const shownWithLabel = async (text: string, timeout: number) =>
  lookFor(
    async () => {
      const els = await labelContains(text).getElements()
      // Indexing an empty result gives a not-found placeholder element, not undefined.
      if (els.length === 0) return undefined
      // The banner exposes a container, a button and the text; the button takes the tap.
      for (const e of els) {
        if ((await e.getAttribute('type')) === 'XCUIElementTypeButton') return e
      }
      return els[0]
    },
    {interval: 300, timeout}
  )

// The id of the conversation whose only participant is `username`, read from the inbox layout.
export const selfConversationID = async (username: string) => {
  // The inbox layout loads with the inbox.
  await escapeToTabs()
  await navigateToChat()
  return waitFor(
    'the self conversation in the inbox',
    async () =>
      jsEval<string | null>(
        `const layout = kbModule('chat/inbox/layout-state.tsx').useInboxLayoutState.getState().layout
         const row = layout && layout.smallTeams.find(t => !t.isTeam && t.name === ${JSON.stringify(username)})
         return row ? row.convID : null`
      ).then(id => id ?? undefined),
    {interval: 500, timeout: 30000}
  )
}

// Opens the smoke user's conversation with themselves and returns its id. The conversation is
// opened by id: a keybase://chat/<user> link resolves the conversation through a lookup that can
// sit on a placeholder id for a long time.
export const openSelfConversation = async (username: string) => {
  const convID = await selfConversationID(username)
  openUrl(`keybase://convid/${convID}`)
  await waitFor(
    'the self conversation to open',
    async () => {
      const {screen} = await appSnapshot()
      return screen?.name === 'chatConversation' && screen.params?.['conversationIDKey'] === convID ? true : undefined
    },
    {interval: 500, timeout: 20000}
  )
  // JS names the screen before the native push lands. Until it does, the tab root still looks
  // current, so a reset right after this would skip popping the conversation and leave the tab
  // bar hidden under it. iPad's split view never shows a back button here, hence the catch.
  await waitForTestID(T.CHAT_INPUT, 10000)
  await browser.waitUntil(async () => !(await atTabs()), {interval: 150, timeout: 5000}).catch(() => {})
  return convID
}

// The app's NSLog lines starting with a prefix since a time, read from the simulator's unified
// log. NSLog lines carry no subsystem, so the prefix is what picks them out.
export const nsLogSince = (prefix: string, since: Date, udid = deviceUdid()) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())} ${pad(since.getHours())}:${pad(since.getMinutes())}:${pad(since.getSeconds())}`
  return simctl(
    'spawn',
    udid,
    'log',
    'show',
    '--start',
    start,
    '--info',
    '--style',
    'compact',
    '--predicate',
    `eventMessage BEGINSWITH "${prefix}"`
  )
    .split('\n')
    .filter(l => l.includes(prefix))
}
