import {execFileSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {udidForName} from './app'
import {escapeToTabs, navigateToChat} from './navigate'

// Lifecycle flows assert on state and logs, never on screenshots:
// - JS state is read from the running app through the Metro inspector (Runtime.evaluate).
// - Native and Go transitions come from the app container's Go log (ios.log).
// - JS log lines (logger.info/warn) come from Metro's start.log as metro:client_log events.
//   start.log is shared by every device attached to Metro, so flows that read it keep a
//   single app running.

export const BUNDLE_ID = 'keybase.ios'

export const deviceName = () => process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
export const deviceUdid = () => process.env['KB_IOS_UDID'] ?? udidForName(deviceName())

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const simctl = (...args: Array<string>): string =>
  execFileSync('xcrun', ['simctl', ...args], {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']})

// Retries until check returns a value, or throws with the last error once the timeout passes.
export const waitFor = async <R>(
  what: string,
  check: () => Promise<R | undefined> | R | undefined,
  {timeout = 20000, interval = 250}: {timeout?: number; interval?: number} = {}
): Promise<R> => {
  const end = Date.now() + timeout
  let lastErr: unknown
  for (;;) {
    try {
      const r = await check()
      if (r !== undefined) return r
    } catch (e) {
      lastErr = e
    }
    if (Date.now() > end) {
      const detail = lastErr instanceof Error ? `: ${lastErr.message}` : ''
      throw new Error(`timed out after ${timeout}ms waiting for ${what}${detail}`)
    }
    await sleep(interval)
  }
}

// -- app process ------------------------------------------------------------

// The pid of the running app on the simulator, or undefined when it isn't running.
export const appPid = (udid = deviceUdid()): number | undefined => {
  const out = simctl('spawn', udid, 'launchctl', 'list')
  for (const line of out.split('\n')) {
    if (line.includes(`UIKitApplication:${BUNDLE_ID}[`)) {
      const pid = Number(line.trim().split(/\s+/)[0])
      return Number.isFinite(pid) && pid > 0 ? pid : undefined
    }
  }
  return undefined
}

export const terminateApp = async (udid = deviceUdid()) => {
  try {
    simctl('terminate', udid, BUNDLE_ID)
  } catch {}
  await waitFor('the app to exit', () => (appPid(udid) === undefined ? true : undefined), {timeout: 10000})
}

// Crash reports for the app written after `since`. The simulator writes them to the host's
// DiagnosticReports, named after the executable.
export const crashReportsSince = (since: number): Array<string> => {
  const dir = path.join(os.homedir(), 'Library/Logs/DiagnosticReports')
  let names: Array<string>
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter(n => /^Keybase[-_].*\.(ips|crash)$/.test(n))
    .map(n => path.join(dir, n))
    .filter(p => fs.statSync(p).mtimeMs >= since)
}

// -- Metro inspector ----------------------------------------------------------

const metroOrigin = 'http://127.0.0.1:8081'

type InspectorPage = {deviceName?: string; appId?: string; webSocketDebuggerUrl: string}

type EvalResponse = {
  id: number
  result?: {result?: {value?: unknown}; exceptionDetails?: {text?: string}}
}

// Metro keeps a page per JS runtime the device has started; the newest is last.
const inspectorUrl = async (device: string) => {
  const res = await fetch(`${metroOrigin}/json/list`)
  const pages = (await res.json()) as Array<InspectorPage>
  const page = pages.filter(p => p.deviceName === device && p.appId === BUNDLE_ID).at(-1)
  if (!page) throw new Error(`no Metro inspector page for ${device}`)
  return page.webSocketDebuggerUrl.replace('ws://localhost:', 'ws://127.0.0.1:')
}

// Metro dev bundles register modules by path; this finds and requires one by that path.
const prelude = `const kbModule = name => { for (const [id, m] of __r.getModules()) if (m.verboseName === name) return __r(id); throw new Error('no module ' + name) };`

// Evaluates a synchronous function body in the app's JS runtime and returns its value.
// Only works against a debug build served by Metro.
export const jsEval = async <R>(body: string, device = deviceName()): Promise<R> => {
  const url = await inspectorUrl(device)
  // The inspector proxy rejects connections without a local Origin; Node's WebSocket
  // takes headers as a non-standard option.
  const WS = WebSocket as unknown as new (url: string, opts: {headers: Record<string, string>}) => WebSocket
  const ws = new WS(url, {headers: {Origin: metroOrigin}})
  try {
    return await new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('inspector evaluate timed out')), 10000)
      ws.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error('inspector connection failed'))
      })
      ws.addEventListener('open', () => {
        const expression = `(() => { ${prelude} ${body} })()`
        ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression, returnByValue: true}}))
      })
      ws.addEventListener('message', (e: MessageEvent) => {
        const m = JSON.parse(String(e.data)) as EvalResponse
        if (m.id !== 1) return
        clearTimeout(timer)
        if (m.result?.exceptionDetails) {
          reject(new Error(`app evaluate threw: ${m.result.exceptionDetails.text ?? 'unknown'}`))
        } else {
          resolve(m.result?.result?.value as R)
        }
      })
    })
  } finally {
    ws.close()
  }
}

export type AppSnapshot = {
  loggedIn: boolean
  mobileAppState: string
  nativeAppState: string
  httpSrv: {address: string; token: string}
  screen?: {name?: string; params?: Record<string, unknown>}
}

// JS app state (shell store, fed by native scene notifications), the native value it
// was fed from, the http server address JS uses for images, and the visible screen.
export const appSnapshot = async (device = deviceName()) =>
  jsEval<AppSnapshot>(
    `const shell = kbModule('stores/shell.tsx').useShellState.getState()
     const config = kbModule('stores/config.tsx').useConfigState.getState()
     const kb = kbModule('node_modules/react-native-kb/src/index.tsx')
     const screen = kbModule('constants/router.tsx').getVisibleScreen()
     return {
       httpSrv: config.httpSrv,
       loggedIn: config.loggedIn,
       mobileAppState: shell.mobileAppState,
       nativeAppState: kb.iosGetAppState(),
       screen: screen ? {name: screen.name, params: screen.params} : undefined,
     }`,
    device
  )

// Waits for a relaunched JS runtime to be logged in and report `state` from both JS and native.
export const waitForAppState = async (state: string, device = deviceName(), timeout = 60000) =>
  waitFor(
    `JS app state ${state}`,
    async () => {
      const s = await appSnapshot(device)
      return s.loggedIn && s.mobileAppState === state && s.nativeAppState === state && s.httpSrv.address
        ? s
        : undefined
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

type LogMark = {file: string; offset: number; ino: number}

const statOrUndefined = (file: string) => {
  try {
    return fs.statSync(file)
  } catch {
    return undefined
  }
}

const readFrom = (file: string, offset: number) => {
  const size = fs.statSync(file).size
  if (size <= offset) return ''
  const fd = fs.openSync(file, 'r')
  try {
    const buf = Buffer.alloc(size - offset)
    fs.readSync(fd, buf, 0, buf.length, offset)
    return buf.toString('utf8')
  } finally {
    fs.closeSync(fd)
  }
}

const markFile = (file: string): LogMark => {
  const st = statOrUndefined(file)
  return {file, ino: st?.ino ?? 0, offset: st?.size ?? 0}
}

// Lines written to the file since the mark. The Go log is replaced by a new file when the app
// launches and rotated aside when it grows too big, so when the file at the path is no longer
// the marked one, the rest of the marked file (found by inode, if still there) is read first,
// then the new file from its start.
const linesSince = (mark: LogMark): Array<string> => {
  const st = statOrUndefined(mark.file)
  if (!st) return []
  let text: string
  if (st.ino === mark.ino) {
    text = readFrom(mark.file, mark.offset)
  } else {
    const dir = path.dirname(mark.file)
    const moved = fs
      .readdirSync(dir)
      .map(n => path.join(dir, n))
      .find(p => statOrUndefined(p)?.ino === mark.ino)
    text = (moved ? readFrom(moved, mark.offset) : '') + readFrom(mark.file, 0)
  }
  return text.split('\n').filter(Boolean)
}

// The Go service log inside the app's data container. The container moves on reinstall,
// so resolve it each time.
export const goLogPath = (udid = deviceUdid()) =>
  path.join(simctl('get_app_container', udid, BUNDLE_ID, 'data').trim(), 'Library/Caches/Keybase/logs/ios.log')

export const goLogMark = (udid = deviceUdid()): LogMark => markFile(goLogPath(udid))

export const goLogSince = (mark: LogMark): Array<string> => linesSince(mark)

export const metroLogPath = path.resolve('.expo/dev/logs/start.log')

export const metroLogMark = (): LogMark => markFile(metroLogPath)

// JS console output since the mark, one string per call (arguments joined by spaces).
export const metroClientLogSince = (mark: LogMark): Array<string> =>
  linesSince(mark)
    .filter(l => l.includes('"metro:client_log"'))
    .map(l => {
      try {
        const e = JSON.parse(l) as {data?: Array<unknown>}
        return (e.data ?? []).map(d => (typeof d === 'string' ? d : JSON.stringify(d))).join(' ')
      } catch {
        return ''
      }
    })
    .filter(Boolean)

export const findLines = (lines: Array<string>, re: RegExp) => lines.filter(l => re.test(l))

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

// Go's MobileAppState transitions since the mark, e.g. ['FOREGROUND', 'BACKGROUND'].
export const goAppStateUpdates = (mark: LogMark) =>
  goLogSince(mark)
    .map(l => /MobileAppState\.Update: useful update: (\w+)/.exec(l)?.[1])
    .filter((s): s is string => !!s)

// -- simulator actions -------------------------------------------------------

export const openUrl = (url: string, udid = deviceUdid()) => simctl('openurl', udid, url)

export const sendPush = (payload: object, udid = deviceUdid()) => {
  const file = path.join(os.tmpdir(), `kb-e2e-push-${process.pid}-${Date.now()}.json`)
  fs.writeFileSync(file, JSON.stringify(payload))
  try {
    simctl('push', udid, BUNDLE_ID, file)
  } finally {
    fs.rmSync(file, {force: true})
  }
}

export const setLocation = (lat: number, lon: number, udid = deviceUdid()) =>
  simctl('location', udid, 'set', `${lat},${lon}`)

export const isBooted = (udid: string) => simctl('list', 'devices', 'booted').includes(udid)

// -- app, springboard and chat actions -----------------------------------------

export const backgroundApp = async () => browser.execute('mobile: backgroundApp', {seconds: -1})

export const activateApp = async () => browser.execute('mobile: activateApp', {bundleId: BUNDLE_ID})

export const launchApp = async () => browser.execute('mobile: launchApp', {bundleId: BUNDLE_ID})

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

// Waits for the system to show a notification whose text contains `body`, as a banner or,
// once the banner is gone, a row in Notification Center, and taps it when asked. Returns where
// it was found; a caller that doesn't tap must close Notification Center when it was opened.
export const findNotification = async (body: string, {tap}: {tap: boolean}) =>
  withSpringboard(async (): Promise<'banner' | 'center' | undefined> => {
    const shown = async () => {
      const els = await labelContains(body).getElements()
      // The banner exposes a container, a button and the text; the button takes the tap.
      for (const e of els) {
        if ((await e.getAttribute('type')) === 'XCUIElementTypeButton') return e
      }
      return els[0]
    }
    const inBanner = await waitFor('the notification banner', shown, {interval: 300, timeout: 8000}).catch(() => undefined)
    if (inBanner) {
      if (tap) await inBanner.click()
      return 'banner'
    }
    await openNotificationCenter()
    const inCenter = await waitFor('the notification in Notification Center', shown, {interval: 300, timeout: 8000}).catch(
      () => undefined
    )
    if (!inCenter) {
      await closeNotificationCenter()
      return undefined
    }
    if (tap) await inCenter.click()
    return 'center'
  })

// Notification banners need the user's permission. Grants it through the app's own request
// and the system prompt when the simulator hasn't been asked yet.
export const ensureNotificationPermission = async () => {
  const has = async () => jsEval<boolean>(`return kbModule('stores/push.tsx').usePushState.getState().hasPermissions`)
  if (await has()) return
  await jsEval(`kbModule('stores/push.tsx').usePushState.getState().dispatch.requestPermissions(); return true`)
  await withSpringboard(async () => {
    const allow = browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Allow"')
    await allow.waitForExist({interval: 250, timeout: 15000})
    await waitFor(
      'the notification prompt to close',
      async () => {
        if (!(await allow.isExisting())) return true
        await allow.click().catch(() => {})
        return undefined
      },
      {interval: 1000, timeout: 15000}
    )
  })
  await waitFor(
    'notification permission',
    async () => {
      await jsEval(`kbModule('stores/push.tsx').usePushState.getState().dispatch.checkPermissions(); return true`)
      return (await has()) ? true : undefined
    },
    {interval: 1000, timeout: 15000}
  )
}

// Opens the smoke user's conversation with themselves and returns its id. The id comes from
// the inbox layout, and the conversation is opened by id: a keybase://chat/<user> link resolves
// the conversation through a lookup that can sit on a placeholder id for a long time.
export const openSelfConversation = async (username: string) => {
  // The inbox layout loads with the inbox.
  await escapeToTabs()
  await navigateToChat()
  const convID = await waitFor(
    'the self conversation in the inbox',
    async () =>
      jsEval<string | null>(
        `const layout = kbModule('chat/inbox/layout-state.tsx').useInboxLayoutState.getState().layout
         const row = layout && layout.smallTeams.find(t => !t.isTeam && t.name === ${JSON.stringify(username)})
         return row ? row.convID : null`
      ).then(id => id ?? undefined),
    {interval: 500, timeout: 30000}
  )
  openUrl(`keybase://convid/${convID}`)
  await waitFor(
    'the self conversation to open',
    async () => {
      const {screen} = await appSnapshot()
      return screen?.name === 'chatConversation' && screen.params?.['conversationIDKey'] === convID ? true : undefined
    },
    {interval: 500, timeout: 20000}
  )
  return convID
}

// A second simulator signed in to the same account sends the message, so it reaches this
// device as an incoming message from another device.
export const senderDeviceName = () => process.env['KB_IOS_SENDER_DEVICE'] ?? 'iPadTest'

export const startSenderDevice = async (username: string) => {
  const name = senderDeviceName()
  const udid = udidForName(name)
  const bootedHere = !isBooted(udid)
  if (bootedHere) {
    simctl('boot', udid)
    simctl('bootstatus', udid, '-b')
  }
  const stop = async () => {
    await terminateApp(udid).catch(() => {})
    if (bootedHere) simctl('shutdown', udid)
  }
  simctl('launch', udid, BUNDLE_ID)
  await waitFor(
    `${name} to be logged in as ${username}`,
    async () =>
      (await jsEval<boolean>(
        `return kbModule('stores/config.tsx').useConfigState.getState().loggedIn &&
           kbModule('stores/current-user.tsx').useCurrentUserState.getState().username === ${JSON.stringify(username)}`,
        name
      ))
        ? true
        : undefined,
    {interval: 1000, timeout: 180000}
  ).catch(async (e: unknown) => {
    await stop()
    throw e
  })
  const send = async (conversationIDKey: string, text: string) =>
    jsEval(
      `kbModule('chat/conversation/send-actions.tsx').sendTextToConversation(${JSON.stringify(conversationIDKey)}, ${JSON.stringify(username)}, ${JSON.stringify(text)}); return true`,
      name
    )
  return {send, stop}
}

// The app's own os_log lines for a category (subsystem com.keybase.app) since a time, read from
// the simulator's unified log.
export const nativeLogSince = (category: string, since: Date, udid = deviceUdid()) => {
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
    `subsystem == "com.keybase.app" AND category == "${category}"`
  )
    .split('\n')
    .filter(l => l.includes(`[com.keybase.app:${category}]`))
}
