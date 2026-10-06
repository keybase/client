// Captures tour entries from the dev iOS app on a simulator: Appium (a standalone webdriverio
// session) for screenshots, element rects and setup taps; Metro's inspector for JS eval. The app's
// router is reached as the constants/router.tsx module (desktop's DEBUGRouter2 global points at the
// same module; native never sets that global). Navigation is reset/append only; nothing that changes
// account state is ever tapped.
import {execFileSync, spawn, type ChildProcess} from 'child_process'
import * as http from 'http'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {homedir} from 'os'
import {remote} from 'webdriverio'
import {iosCapabilities, udidForName} from '../ios-appium/helpers/app.ts'
import {evalInPage, inspectorPageFor} from '../shared/metro-eval.ts'
import {
  fixDate,
  IDLE_QUIET_MS,
  settle,
  waitFor,
  waitForQuiet,
  withDeadline,
  type Capture,
  type Prepared,
} from './driver-desktop.mts'
import type {Rect} from './compare.mts'
import {CHAT_MESSAGE_LIST} from '../shared/test-ids.ts'
import {resolveParams} from './resolve.mts'
import type {Theme, TourEntry, SetupStep} from './tour-types.ts'
import {fixtureCapture, type FixtureHooks} from './fixtures/drive.mts'

export type IosSession = {
  // Fixes Date, remounts every screen under it, and visits each phone tab once.
  prepare: (opts: {theme: Theme; frozenAt: number; reload: boolean}) => Promise<Prepared>
  // Resets to the entry's tab root (modals cleared, stack popped). It does not reset scroll
  // position or a selected sub-tab: a setup step that scrolls or switches leaves that screen so
  // until the next reload.
  capture: (entry: TourEntry) => Promise<Capture>
  // Restores the app (real Date, which takes a JS reload) and the simulator settings prepare
  // changed, ends the Appium session and stops the Appium server this session started. The
  // running app keeps Reduce Motion and Reduce Transparency on until its next launch: both are
  // read at startup.
  close: () => Promise<void>
  // What close would undo, as commands for a person to run when the process dies before close.
  cleanupCommands: () => Array<string>
}

// Each rect clipped to the window, dropping those wholly outside it. Window points, origin 0,0.
export const clipToWindow = (rects: ReadonlyArray<Rect>, win: {width: number; height: number}): Array<Rect> =>
  rects.flatMap(r => {
    const x = Math.max(0, r.x)
    const y = Math.max(0, r.y)
    const width = Math.min(win.width, r.x + r.width) - x
    const height = Math.min(win.height, r.y + r.height) - y
    return width > 0 && height > 0 ? [{height, width, x, y}] : []
  })

export type IosOriginal ={accessibility: Array<{key: string; value: string | undefined}>; appearance: string}

// `original` is what prepare found (undefined before prepare touched the simulator); `appium` is
// whether the Appium server this session started may still be running.
export const iosCleanupCommands = (opts: {udid: string; port: number; original: IosOriginal | undefined; appium: boolean}) => {
  const {udid, original} = opts
  const out: Array<string> = []
  if (original) {
    out.push(`xcrun simctl status_bar ${udid} clear`)
    if (original.appearance === 'light' || original.appearance === 'dark') {
      out.push(`xcrun simctl ui ${udid} appearance ${original.appearance}`)
    }
    for (const {key, value} of original.accessibility) {
      out.push(
        value === undefined
          ? `xcrun simctl spawn ${udid} defaults delete com.apple.Accessibility ${key}`
          : `xcrun simctl spawn ${udid} defaults write com.apple.Accessibility ${key} -bool ${value === '1' ? 'true' : 'false'}`
      )
    }
    // a relaunch drops the fixed Date and picks up the accessibility settings
    out.push(`xcrun simctl terminate ${udid} ${BUNDLE_ID}; xcrun simctl launch ${udid} ${BUNDLE_ID}`)
  }
  if (opts.appium) out.push(`kill $(lsof -t -iTCP:${opts.port} -sTCP:LISTEN)   # the gate's Appium`)
  return out
}

const BUNDLE_ID = 'keybase.ios'
const SHARED_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const APPIUM_START_MS = 30_000
const APPIUM_STOP_MS = 5_000
// a fresh WDA launch can take most of the capability's 120s wdaLaunchTimeout
const SESSION_MS = 180_000
const SIMCTL_MS = 10_000
const EVAL_MS = 5_000
const APP_CMD_MS = 30_000
const BOOT_MS = 90_000
const RESET_MS = 5_000
const READY_MS = 10_000
const SETUP_MS = 5_000
const SETTLE = {deadlineMs: 5_000, intervalMs: 250}
// The glass header buttons of a pushed screen fade their shadow out for about 2s after the push,
// and two screenshots 250ms apart can match in the middle of it, so a capture waits for two that
// match a second apart.
const CAPTURE_SETTLE = {deadlineMs: 8_000, intervalMs: 1_000}

export const appiumHome = () => process.env['APPIUM_HOME'] || `${homedir()}/.appium`
export const appiumPort = () => Number(process.env['KB_APPIUM_PORT'] ?? 4723)
// As in ios-appium/wdio.conf.ts: a non-default Appium port gets its own WDA port, so parallel
// simulators don't both take 8100.
export const visualCapabilities = (udid: string) => {
  const port = appiumPort()
  return iosCapabilities(udid, {wdaLocalPort: port === 4723 ? undefined : 8100 + (port - 4723)})
}

export const STATUS_BAR_ARGS: ReadonlyArray<string> = [
  '--time', '9:41',
  '--dataNetwork', 'wifi',
  '--wifiMode', 'active',
  '--wifiBars', '3',
  '--cellularMode', 'active',
  '--cellularBars', '4',
  '--batteryState', 'charged',
  '--batteryLevel', '100',
]

const simctl = (...args: Array<string>) =>
  execFileSync('xcrun', ['simctl', ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: SIMCTL_MS}).trim()

// Accessibility settings a visual run turns on:
// - Reduce Motion: Reanimated animations (its default ReduceMotion.System) jump to their end.
// - Reduce Transparency: the iOS 26 glass tab bar otherwise samples the content scrolled under it,
//   and the sample depends on what was drawn before, so the same screen captured twice differs.
export const ACCESSIBILITY_KEYS: ReadonlyArray<string> = ['ReduceMotionEnabled', 'EnhancedBackgroundContrastEnabled']

const accessibilityDefaults = (udid: string, key: string, verb: 'read' | 'write' | 'delete', ...value: Array<string>) =>
  simctl('spawn', udid, 'defaults', verb, 'com.apple.Accessibility', key, ...value)

// The key's current value ('1' or '0'), or undefined when it was never set.
const readAccessibility = (udid: string, key: string) => {
  try {
    return accessibilityDefaults(udid, key, 'read')
  } catch {
    return undefined
  }
}

// node's http rather than fetch: this file is also type-checked against react-native's fetch
const appiumUp = async (port: number) =>
  new Promise<boolean>(resolve => {
    const req = http.get({host: '127.0.0.1', path: '/status', port, timeout: 1_000}, res => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(false))
  })

const startAppium = async (port: number): Promise<ChildProcess> => {
  if (await appiumUp(port)) {
    throw new Error(`something already answers on port ${port}; stop it or set KB_APPIUM_PORT`)
  }
  const child = spawn(
    path.join(SHARED_DIR, 'node_modules', '.bin', 'appium'),
    ['--port', String(port), '--base-path', '/', '--log-level', 'error'],
    {env: {...process.env, APPIUM_HOME: appiumHome()}, stdio: ['ignore', 'ignore', 'pipe']}
  )
  // A run that exits before close (its overall deadline, a signal) would otherwise orphan Appium.
  const killOnExit = () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
  process.on('exit', killOnExit)
  child.once('exit', () => process.off('exit', killOnExit))
  let stderr = ''
  child.stderr.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-2_000)
  })
  try {
    await waitFor(`Appium to answer on port ${port}`, APPIUM_START_MS, async () => {
      if (child.exitCode !== null) throw new Error(`Appium exited with ${child.exitCode}: ${stderr}`)
      return appiumUp(port)
    })
  } catch (e) {
    await stopAppium(child)
    throw e
  }
  return child
}

const stopAppium = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM')
  try {
    await withDeadline(exited, APPIUM_STOP_MS, 'Appium to exit')
  } catch {
    child.kill('SIGKILL')
  }
}

const ROUTER = `const r = kbModule('constants/router.tsx');`
// Host views (fiber tag 5) in a screen that carry a testID, read through the React DevTools hook a
// dev build has.
const HOSTS_WITH_TESTID = `
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (!hook?.getFiberRoots) throw new Error('no React DevTools hook; is this a dev build?')
  // a view in a screen: some component above it takes a route and its navigation; the overlays
  // drawn over every screen (the global error bar, runtime stats) sit outside the navigator
  const inScreen = f => {
    for (let p = f.return; p; p = p.return) if (p.memoizedProps?.route && p.memoizedProps?.navigation) return true
    return false
  }
  const hosts = []
  for (const id of hook.renderers.keys()) {
    for (const root of hook.getFiberRoots(id)) {
      const stack = [root.current]
      while (stack.length) {
        const f = stack.pop()
        if (f.tag === 5 && f.stateNode && f.memoizedProps?.testID && inScreen(f)) hosts.push(f.stateNode)
        if (f.child) stack.push(f.child)
        if (f.sibling) stack.push(f.sibling)
      }
    }
  }`
// Types into the text input at or under the host view with testID, through the input's own
// onChangeText (and, for Enter, onSubmitEditing): XCUITest's typing into a controlled field that
// selects its text on focus drops and keeps characters unevenly.
export const typeIntoTarget = (testID: string, text: string, enter: boolean) => `
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (!hook?.getFiberRoots) throw new Error('no React DevTools hook; is this a dev build?')
  const id = ${JSON.stringify(testID)}
  let target
  for (const id2 of hook.renderers.keys()) {
    for (const root of hook.getFiberRoots(id2)) {
      const stack = [root.current]
      while (stack.length && !target) {
        const f = stack.pop()
        if (f.tag === 5 && f.memoizedProps?.testID === id) target = f
        if (f.child) stack.push(f.child)
        if (f.sibling) stack.push(f.sibling)
      }
    }
  }
  if (!target) throw new Error('no host view with testID ' + id)
  let input
  const stack = [target]
  while (stack.length && !input) {
    const f = stack.pop()
    if (typeof f.memoizedProps?.onChangeText === 'function') input = f.memoizedProps
    if (f.child) stack.push(f.child)
    if (f !== target && f.sibling) stack.push(f.sibling)
  }
  if (!input) throw new Error('no text input under testID ' + id)
  input.onChangeText(${JSON.stringify(text)})
  if (${enter}) input.onSubmitEditing?.({nativeEvent: {text: ${JSON.stringify(text)}}})
`

// Scrolls the host view with this testID into the middle of what scrolls it, read off React's fiber
// tree as React DevTools does, walking up from the host fiber:
// - in a virtualized list row (a cell, whose props carry its index): the list (the first instance
//   above with scrollToIndex) centres that row;
// - otherwise in a ScrollView (its class instance): scrollTo the view's offset in the content,
//   measured synchronously (getBoundingClientRect, RN's DOM API) and clamped to the content.
// Both without animation. Returns 'row', 'scrollView', or 'none' when neither holds the view.
export const scrollToTarget = (testID: string) => `
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (!hook?.getFiberRoots) throw new Error('no React DevTools hook; is this a dev build?')
  const id = ${JSON.stringify(testID)}
  let target
  for (const id2 of hook.renderers.keys()) {
    for (const root of hook.getFiberRoots(id2)) {
      const stack = [root.current]
      while (stack.length && !target) {
        const f = stack.pop()
        if (f.tag === 5 && f.memoizedProps?.testID === id) target = f
        if (f.child) stack.push(f.child)
        if (f.sibling) stack.push(f.sibling)
      }
    }
  }
  if (!target) throw new Error('no host view with testID ' + id)
  const rectOf = (el, what) => {
    if (typeof el?.getBoundingClientRect !== 'function') throw new Error('no synchronous layout for ' + what + ' of ' + id)
    return el.getBoundingClientRect()
  }
  let index
  for (let f = target.return; f; f = f.return) {
    const p = f.memoizedProps
    const node = f.stateNode
    if (index === undefined && p && typeof p.index === 'number' && 'cellKey' in p) index = p.index
    if (index !== undefined && node && typeof node.scrollToIndex === 'function') {
      node.scrollToIndex({animated: false, index, viewPosition: 0.5})
      return 'row'
    }
    if (index === undefined && node && typeof node.scrollTo === 'function' && typeof node.getInnerViewRef === 'function' && typeof node.getNativeScrollRef === 'function') {
      // a host view's public instance is made on demand, so one no ref asked for has none yet
      const renderer = kbModule('node_modules/react-native/Libraries/ReactNative/RendererImplementation.js')
      const t = rectOf(renderer.getPublicInstanceFromInternalInstanceHandle(target), 'the view')
      const c = rectOf(node.getInnerViewRef(), 'the scroll content')
      const v = rectOf(node.getNativeScrollRef(), 'the scroll view')
      const along = (start, size) => Math.min(Math.max(0, c[size] - v[size]), Math.max(0, t[start] - c[start] - (v[size] - t[size]) / 2))
      node.scrollTo(node.props?.horizontal ? {animated: false, x: along('left', 'width'), y: 0} : {animated: false, x: 0, y: along('top', 'height')})
      return 'scrollView'
    }
  }
  return 'none'`
// Pauses every expo-video player on its first frame, as desktop pauses autoplay videos (a looping
// giphy unfurl shows a different frame in every screenshot). Players live in hook state
// (useVideoPlayer), so each mounted fiber's hooks are searched for one, as React DevTools reads them.
export const STILL_VIDEOS = `
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (!hook?.getFiberRoots) throw new Error('no React DevTools hook; is this a dev build?')
  const isPlayer = v => !!v && typeof v === 'object' && typeof v.pause === 'function' && typeof v.replace === 'function' && 'currentTime' in v
  const players = new Set()
  for (const id of hook.renderers.keys()) {
    for (const root of hook.getFiberRoots(id)) {
      const stack = [root.current]
      while (stack.length) {
        const f = stack.pop()
        if (f.tag === 0 || f.tag === 11 || f.tag === 15) {
          for (let h = f.memoizedState; h && typeof h === 'object' && 'next' in h; h = h.next) {
            const v = h.memoizedState
            if (isPlayer(v)) players.add(v)
            else if (Array.isArray(v) && isPlayer(v[0])) players.add(v[0])
          }
        }
        if (f.child) stack.push(f.child)
        if (f.sibling) stack.push(f.sibling)
      }
    }
  }
  for (const p of players) {
    try {
      p.pause()
      p.currentTime = 0
    } catch {}
  }
  return players.size`
const HOP_TAB = 'tabs.settingsTab'
const HOP_TAB_ALT = 'tabs.peopleTab'

export async function openIos(opts: {device: string}): Promise<IosSession> {
  const {device} = opts
  const udid = udidForName(device)
  const port = appiumPort()
  const appium = await startAppium(port)
  let browser: WebdriverIO.Browser
  try {
    browser = await withDeadline(
      remote({
        capabilities: visualCapabilities(udid),
        connectionRetryCount: 0,
        hostname: '127.0.0.1',
        logLevel: 'error',
        path: '/',
        port,
      }),
      SESSION_MS,
      'starting the Appium session'
    )
  } catch (e) {
    await stopAppium(appium)
    throw e
  }

  const appEval = async <R,>(body: string, what: string) =>
    withDeadline(
      (async () => evalInPage<R>(await inspectorPageFor(device, BUNDLE_ID), body))(),
      EVAL_MS,
      what
    )
  const appCmd = async <R,>(p: Promise<R>, what: string) => withDeadline(p, APP_CMD_MS, what)

  // A token set on the JS runtime; a runtime without it is a fresh one (after a reload or relaunch).
  // Metro keeps the same inspector page across reloads, so the page alone can't tell.
  let runtimeToken = ''
  const markRuntime = async () => {
    runtimeToken = `${Date.now()}-${Math.random()}`
    await appEval(`globalThis.__kbVisualRuntime = ${JSON.stringify(runtimeToken)}`, 'marking the JS runtime')
  }
  // A logged in runtime with the router and the waiting store up; with `fresh`, also one that
  // started after the last markRuntime.
  const waitForRuntime = async (fresh: boolean) => {
    let last = ''
    try {
      await waitFor(`a ${fresh ? 'fresh, ' : ''}logged in JS runtime`, BOOT_MS, async () => {
        try {
          const r = await appEval<{fresh: boolean; loggedIn: boolean; waiting: boolean}>(
            `${ROUTER}
             const root = r.getRootState()
             return {
               fresh: globalThis.__kbVisualRuntime !== ${JSON.stringify(runtimeToken)},
               loggedIn: root?.routes?.[0]?.name === 'loggedIn',
               waiting: !!globalThis.__ZUSTAND_HMR__?.get('waiting'),
             }`,
            'reading the JS runtime'
          )
          last = JSON.stringify(r)
          return (r.fresh || !fresh) && r.loggedIn && r.waiting
        } catch (e) {
          last = (e as Error).message
          return false
        }
      })
    } catch (e) {
      throw new Error(`${(e as Error).message} (last: ${last})`, {cause: e})
    }
  }
  const reloadJs = async () => {
    await markRuntime()
    await appEval(
      `setTimeout(() => {
         const m = kbModule('node_modules/react-native/Libraries/Utilities/DevSettings.js')
         ;(m.default ?? m).reload()
       }, 0)`,
      'DevSettings.reload'
    )
    await waitForRuntime(true)
  }
  const relaunchApp = async () => {
    await markRuntime().catch(() => {})
    await appCmd(browser.terminateApp(BUNDLE_ID), 'terminating the app')
    await appCmd(browser.activateApp(BUNDLE_ID), 'activating the app')
    await waitForRuntime(true)
  }

  // Reanimated reads Reduce Motion once, when its native module starts; RN's AccessibilityInfo
  // answers asynchronously, so its answer is parked on a global and polled.
  const accessibilityOn = async () => {
    const token = `${Date.now()}-${Math.random()}`
    await appEval(
      `const m = kbModule('node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.js')
       const A = m.default ?? m
       Promise.all([A.isReduceMotionEnabled(), A.isReduceTransparencyEnabled()]).then(v => {
         globalThis.__kbVisualAccessibility = {token: ${JSON.stringify(token)}, motion: v[0], transparency: v[1]}
       })`,
      'asking AccessibilityInfo'
    )
    let got: {reanimated: boolean; motion?: boolean; transparency?: boolean} | undefined
    await waitFor('AccessibilityInfo to answer', EVAL_MS, async () => {
      got = await appEval(
        `const a = globalThis.__kbVisualAccessibility
         if (a?.token !== ${JSON.stringify(token)}) return undefined
         return {reanimated: globalThis._REANIMATED_IS_REDUCED_MOTION === true, motion: a.motion, transparency: a.transparency}`,
        'reading AccessibilityInfo'
      )
      return !!got
    })
    return !!got && got.reanimated && got.motion === true && got.transparency === true
  }

  const routerAt = async () =>
    appEval<{atRoot: boolean; tab: string | undefined}>(
      `${ROUTER}
       const root = r.getRootState()
       if (!root) throw new Error('no navigation state')
       const tab = r.getTab()
       const tabRoute = root.routes?.[0]?.state?.routes?.find(x => x.name === tab)
       const stackDepth = tabRoute?.state?.routes?.length ?? 1
       return {atRoot: root.routes?.length === 1 && stackDepth === 1, tab}`,
      'reading the router state'
    )
  const switchTo = async (tab: string) => {
    await appEval(`${ROUTER} r.switchTab(${JSON.stringify(tab)})`, `switching to ${tab}`)
    await waitFor(`tab ${tab} to be current`, RESET_MS, async () => (await routerAt()).tab === tab)
  }
  // The glass tab bar's rendering depends on which tab was selected before (seen live: files after
  // chat differs from files after teams), so every capture arrives from the same tab.
  // A screen the last capture pushed is popped on its own tab before leaving it: popped later, its
  // pop would run on the target tab, under the capture, and the tab bar draws differently after it.
  const resetTo = async (tab: string) => {
    await appEval(`${ROUTER} r.clearModals()`, 'clearModals')
    await appEval(`${ROUTER} r.popStack()`, 'popStack')
    await waitFor('the current tab to be at its root', RESET_MS, async () => (await routerAt()).atRoot)
    await switchTo(tab === HOP_TAB ? HOP_TAB_ALT : HOP_TAB)
    await settle(screenshot, SETTLE)
    await switchTo(tab)
    await appEval(`${ROUTER} r.popStack()`, 'popStack')
    await waitFor(`the root of ${tab}`, RESET_MS, async () => (await routerAt()).atRoot)
  }

  // The app follows the system appearance while its preference is 'system'. Any other preference
  // is switched to 'system' in the JS store only (never written to config); a reload reads the real
  // preference back.
  const applyLight = async () =>
    waitFor('the app to be in light mode', RESET_MS, async () =>
      appEval<boolean>(
        `const store = globalThis.__ZUSTAND_HMR__?.get('darkmode')
         if (!store) throw new Error('the darkmode store is not in __ZUSTAND_HMR__; is this a dev build?')
         if (store.getState().darkModePreference !== 'system') store.setState({darkModePreference: 'system'})
         return !store.getState().isDarkMode()`,
        'reading the dark mode store'
      )
    )

  const waitForNoLoading = async () => {
    let busy: Array<string> = []
    try {
      await waitForQuiet('the waiting store to be idle', READY_MS, IDLE_QUIET_MS, async () => {
        busy = await appEval<Array<string>>(
          `return Array.from(globalThis.__ZUSTAND_HMR__.get('waiting').getState().counts.keys())`,
          'reading the waiting store'
        )
        return busy.length === 0
      })
    } catch (e) {
      throw new Error(`${(e as Error).message}: ${busy.join(', ')}`, {cause: e})
    }
  }

  const byTestID = (id: string) => browser.$(`~${id}`)

  const runStep = async (s: SetupStep) => {
    switch (s.kind) {
      case 'openPopup':
      case 'switchSubTab':
      case 'click':
        await withDeadline(byTestID(s.testID).click(), SETUP_MS, `${s.kind} ${s.testID}`)
        return
      case 'type':
        await withDeadline(byTestID(s.testID).waitForExist({timeout: SETUP_MS}), SETUP_MS + 1_000, `finding ${s.testID}`)
        await appEval(typeIntoTarget(s.testID, s.text, !!s.enter), `typing into ${s.testID}`)
        return
      case 'searchThread': {
        await withDeadline(byTestID(CHAT_MESSAGE_LIST).waitForExist({timeout: SETUP_MS}), SETUP_MS + 1_000, 'the conversation')
        const ok = await appEval<boolean>(
          `${ROUTER} const v = r.getVisibleScreen()
           return !!v?.params?.conversationIDKey && r.setRouteParams(v.key, {threadSearch: {query: ${JSON.stringify(s.query)}}})`,
          'opening thread search'
        )
        if (!ok) throw new Error('searchThread: no open conversation to search')
        return
      }
      case 'scrollIntoView': {
        // waits for the element, as desktop's scrollIntoViewIfNeeded does, so the step can gate
        // later steps on something that loads
        await withDeadline(byTestID(s.testID).waitForExist({timeout: SETUP_MS}), SETUP_MS + 1_000, `finding ${s.testID}`)
        if (await withDeadline(byTestID(s.testID).isDisplayed(), SETUP_MS, `is ${s.testID} displayed`)) return
        // Appium's \`mobile: scroll\` gives up on the inverted chat thread (and can wedge WDA), so what
        // scrolls the element is scrolled from JS where it can be (scrollToTarget); only an element
        // in neither a list row nor a ScrollView is left to Appium.
        const how = await appEval<'row' | 'scrollView' | 'none'>(scrollToTarget(s.testID), `scrolling to ${s.testID}`)
        if (how === 'none') {
          const elementId = await withDeadline(byTestID(s.testID).elementId, SETUP_MS, `finding ${s.testID}`)
          await withDeadline(browser.execute('mobile: scroll', {elementId, toVisible: true}), SETUP_MS, `scrolling to ${s.testID}`)
        }
        return
      }
      case 'hover':
        throw new Error(`hover ${s.testID}: hover is desktop only`)
    }
  }

  const screenshot = async () =>
    Buffer.from(await withDeadline(browser.takeScreenshot(), EVAL_MS, 'taking a screenshot'), 'base64')

  // Screenshot pixels per window point.
  let scale: number | undefined
  const screenScale = async () => {
    if (scale === undefined) {
      const info = await withDeadline(
        browser.execute('mobile: deviceScreenInfo') as Promise<{scale?: number}>,
        EVAL_MS,
        'mobile: deviceScreenInfo'
      )
      if (!info.scale) throw new Error('mobile: deviceScreenInfo returned no scale')
      scale = info.scale
    }
    return scale
  }

  // `$$` also finds elements on screens stacked under the current one and rows scrolled out of
  // view; only displayed elements inside the window mask, so a hidden one can't hide a visible region.
  const maskRects = async (entry: TourEntry) => {
    const s = await screenScale()
    const win = await withDeadline(browser.getWindowRect(), SETUP_MS, 'window rect')
    const rects: Array<Rect> = []
    for (const m of entry.masks ?? []) {
      const all = await withDeadline(Promise.resolve(browser.$$(`~${m.testID}`).getElements()), SETUP_MS, `finding mask ${m.testID}`)
      const found: Array<Rect> = []
      for (const e of all) {
        const shown = await withDeadline(browser.isElementDisplayed(e.elementId), SETUP_MS, `is ${m.testID} displayed`)
        if (!shown) continue
        found.push(await withDeadline(browser.getElementRect(e.elementId), SETUP_MS, `rect of ${m.testID}`))
      }
      const visible = clipToWindow(found, win)
      if (visible.length === 0) throw new Error(`mask target ${m.testID} is not on screen (${all.length} found, none displayed in the window)`)
      rects.push(...visible.map(r => ({height: r.height * s, width: r.width * s, x: r.x * s, y: r.y * s})))
    }
    return rects
  }

  // Visits every phone tab once. A tab's first visit after a reload lays its header title out a
  // fraction of a pixel off from every later visit (stable either way), so captures are only
  // comparable when none of them is a first visit.
  const warmTabs = async () => {
    const tabs = await appEval<Array<string>>(`return kbModule('constants/tabs.tsx').phoneTabs`, 'reading the phone tabs')
    for (const tab of tabs) {
      await switchTo(tab)
      await waitForNoLoading()
      await settle(screenshot, SETTLE)
    }
  }

  // Screens mounted before Date was fixed (the restored tab, anything memoized at boot) rendered
  // with the real time. Resetting the navigation root to its own state without route keys gives
  // every route a new key, so every screen remounts under the fixed Date. Checked: no host view
  // in a screen that carried a testID before the reset is still mounted after it.
  const remountScreens = async () => {
    const before = await appEval<number>(
      `${HOSTS_WITH_TESTID}
       globalThis.__kbVisualBeforeRemount = new Set(hosts)
       return hosts.length`,
      'listing mounted views'
    )
    if (before === 0) throw new Error('no mounted view carries a testID; is the app at its tabs?')
    await appEval(
      `const nav = kbModule('constants/navigator.tsx').navigationRef
       const strip = s => s && {index: s.index, routes: s.routes.map(r => ({name: r.name, params: r.params, state: strip(r.state)}))}
       nav.resetRoot(strip(nav.getRootState()))`,
      'resetting the navigation root'
    )
    let left = before
    await waitFor('every screen to remount after the navigation reset', READY_MS, async () => {
      const r = await appEval<{left: number; now: number}>(
        `${HOSTS_WITH_TESTID}
         const old = globalThis.__kbVisualBeforeRemount
         return {left: hosts.filter(x => old.has(x)).length, now: hosts.length}`,
        'checking remounted views'
      )
      left = r.left
      return r.left === 0 && r.now > 0
    }).catch((e: unknown) => {
      throw new Error(`${(e as Error).message}: ${left} of ${before} views kept their instance`, {cause: e})
    })
    await appEval('delete globalThis.__kbVisualBeforeRemount', 'clearing the remount check')
    await waitForRuntime(false)
  }

  const coverageSeq = async () =>
    appEval<number | null>('return globalThis.__kbVisualCoverage?.seq() ?? null', 'coverage seq')
  const coverageMounted = async () =>
    appEval<Array<string> | null>('return globalThis.__kbVisualCoverage?.mounted() ?? null', 'coverage mounted')
  const coverageSince = async (seq: number | null) =>
    seq === null
      ? null
      : appEval<Array<string> | null>(`return globalThis.__kbVisualCoverage?.mountedSince(${seq}) ?? null`, 'coverage mountedSince')

  let prepared = false
  let datePatched = false
  let frozenAt: number | undefined
  // what prepare found, so close can put it back
  let original: IosOriginal | undefined

  const prepare: IosSession['prepare'] = async p => {
    if (p.theme !== 'light') throw new Error(`iOS captures are light only (asked for ${p.theme})`)
    original ??= {
      accessibility: ACCESSIBILITY_KEYS.map(key => ({key, value: readAccessibility(udid, key)})),
      appearance: simctl('ui', udid, 'appearance'),
    }
    simctl('status_bar', udid, 'override', ...STATUS_BAR_ARGS)
    const bar = simctl('status_bar', udid, 'list')
    if (!bar.includes('9:41')) throw new Error(`the status bar override did not take: ${bar}`)
    simctl('ui', udid, 'appearance', 'light')
    // UIKit and Reanimated read these when the app starts, so changing one takes a relaunch.
    let changed = false
    for (const key of ACCESSIBILITY_KEYS) {
      if (readAccessibility(udid, key) !== '1') {
        accessibilityDefaults(udid, key, 'write', '-bool', 'true')
        changed = true
      }
    }
    await waitForRuntime(false)
    let reloaded = true
    if (changed || !(await accessibilityOn())) await relaunchApp()
    else if (p.reload) await reloadJs()
    else reloaded = false
    if (!(await accessibilityOn())) throw new Error('the app does not report Reduce Motion and Reduce Transparency after a relaunch')
    await appEval(`(${fixDate.toString()})(${p.frozenAt})`, 'fixing Date')
    datePatched = true
    frozenAt = p.frozenAt
    await applyLight()
    await remountScreens()
    // the same moment as desktop's: the reloaded app at its tab root and idle, before warmTabs
    let chrome: Prepared['chrome'] = null
    if (reloaded) {
      await waitForNoLoading()
      chrome = await coverageMounted()
    }
    const now = await appEval<number>('return Date.now()', 'reading Date.now')
    if (now !== p.frozenAt) throw new Error(`Date is not fixed in the app: Date.now() is ${now}, wanted ${p.frozenAt}`)
    await warmTabs()
    prepared = true
    return {chrome}
  }

  // ---------------------------------------------------------------- fixtures (fixtures/runtime.ts)

  // How a capture's fixture (fixtures/drive.mts) reaches the app and puts it back after end().
  const fixtureHooks: FixtureHooks = {
    evalApp: appEval,
    reload: async () => {
      if (frozenAt === undefined) throw new Error('a fixture ended before prepare')
      await reloadJs()
      await appEval(`(${fixDate.toString()})(${frozenAt})`, 'fixing Date')
      await applyLight()
      await remountScreens()
      await warmTabs()
    },
    remount: async () => {
      // remounting a state that holds a pushed screen can leave the navigator with no state at all
      // (seen with the device page), so the reset to the tab root comes first
      await appEval(`${ROUTER} r.clearModals(); r.popStack()`, 'popping to the tab root')
      await waitFor('the current tab to be at its root', RESET_MS, async () => (await routerAt()).atRoot)
      await remountScreens()
      // every tab remounted, so each is at its first visit again (see warmTabs), and the next reset's
      // hop through a cold tab can outlast its deadline
      await warmTabs()
    },
    waitFor: async (what, check) => waitFor(what, READY_MS, check),
  }

  const capture: IosSession['capture'] = async entry => {
    let png: Buffer | undefined
    const fixture = fixtureCapture(fixtureHooks, entry.fixture)
    let result: Capture
    try {
      if (!prepared) throw new Error('capture called before prepare')
      await fixture.assertNoneActive()
      // before the reset, so coverage includes what switching to the tab mounts
      const seq = await coverageSeq()
      await resetTo(entry.nav.tab)
      if (entry.fixture) {
        // installed on an idle app, then every screen remounts so none keeps live data
        await waitForNoLoading()
        await fixture.begin()
        await remountScreens()
      }
      const nav = await resolveParams(entry.nav)
      const append = nav.append
      if (append) {
        const ok = await appEval<boolean>(
          `${ROUTER} return r.navigateAppend(${JSON.stringify({name: append.name, params: append.params})})`,
          `navigateAppend ${append.name}`
        )
        if (!ok) throw new Error(`navigateAppend ${append.name} did not navigate`)
      }
      if (nav.thread) {
        await appEval(`${ROUTER} r.navigateToThread(${JSON.stringify(nav.thread)}, 'misc')`, 'navigateToThread')
      }
      if (entry.setup?.length) {
        await waitForNoLoading()
        for (const s of entry.setup) await runStep(s)
      }
      // Exists, not displayed: XCUITest reports a container view that holds other elements (most
      // screen roots) as not visible.
      await byTestID(entry.ready).waitForExist({
        interval: 150,
        timeout: READY_MS,
        timeoutMsg: `testID ${entry.ready} did not appear after ${READY_MS / 1000}s`,
      })
      await fixture.ready()
      await waitForNoLoading()
      // An auto-focused input blinks its caret, so a capture could catch either phase. Desktop
      // screenshots hide the caret; iOS can't, so the input loses focus instead.
      await appEval(
        `const m = kbModule('node_modules/react-native/Libraries/Components/TextInput/TextInputState.js')
         const S = m.default ?? m
         const focused = S.currentlyFocusedInput()
         if (focused) S.blurTextInput(focused)`,
        'blurring the focused input'
      )
      await appEval(STILL_VIDEOS, 'pausing videos on their first frame')
      const settled = await settle(async () => {
        png = await screenshot()
        return png
      }, CAPTURE_SETTLE)
      png = settled.png
      const masks = await maskRects(entry)
      const coverage = await coverageSince(seq)
      result = {coverage, masks, png, status: settled.stable ? 'ok' : 'unstable'}
    } catch (e) {
      result = {coverage: null, error: (e as Error).message, masks: [], png: png ?? Buffer.alloc(0), status: 'failed'}
    }
    const problems = await fixture.end()
    if (problems.length) {
      const why = problems.join('; ')
      result = {...result, error: result.error ? `${result.error}; ${why}` : why, status: 'failed'}
    }
    return result
  }

  const close: IosSession['close'] = async () => {
    try {
      if (datePatched) {
        datePatched = false
        await reloadJs()
      }
    } finally {
      const quiet = (f: () => unknown) => {
        try {
          f()
        } catch {}
      }
      quiet(() => simctl('status_bar', udid, 'clear'))
      if (original) {
        const {accessibility, appearance} = original
        if (appearance === 'light' || appearance === 'dark') quiet(() => simctl('ui', udid, 'appearance', appearance))
        for (const {key, value} of accessibility) {
          quiet(() =>
            value === undefined
              ? accessibilityDefaults(udid, key, 'delete')
              : accessibilityDefaults(udid, key, 'write', '-bool', value === '1' ? 'true' : 'false')
          )
        }
      }
      await withDeadline(browser.deleteSession(), APP_CMD_MS, 'ending the Appium session').catch(() => {})
      await stopAppium(appium)
    }
  }

  const cleanupCommands = () =>
    iosCleanupCommands({appium: appium.exitCode === null && appium.signalCode === null, original, port, udid})

  return {capture, cleanupCommands, close, prepare}
}
