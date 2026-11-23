// The half of a React Native capture session that runs in the app, shared by the iOS and Android
// drivers: Metro's inspector for JS eval, with the app's router reached as the constants/router.tsx
// module (desktop's DEBUGRouter2 global points at the same module; native never sets that global).
// Navigation is reset/append only; nothing that changes account state is ever tapped. What only the
// device can do (screenshots, taps, system settings, relaunching the app) is the NativeDevice's.
import type {Rect} from './compare.mts'
import {evalInPage, inspectorPageFor, lostInspectorPage, retryFor, whileLost} from '../shared/metro-eval.ts'
import {fixDate, IDLE_QUIET_MS, settle, waitFor, waitForQuiet, waitsAtTabRoot, type Capture} from './driver-desktop.mts'
import {withDeadline} from '../shared/deadline.ts'
import {recordingFrom, startPhoneRecorder, takePhoneRecorder} from '../shared/phone-recorder.ts'
import {CHAT_MESSAGE_LIST} from '../shared/test-ids.ts'
import {resolveParams} from './resolve.mts'
import type {Theme, TourEntry, SetupStep} from './tour-types.ts'
import {fixtureCapture, type FixtureHooks} from './fixtures/drive.mts'
import {VISIBLE_FUNCTIONS} from './coverage/visible.ts'

export type NativeSession = {
  // Fixes Date, remounts every screen under it, and visits each tab once.
  prepare: (opts: {theme: Theme; frozenAt: number; reload: boolean}) => Promise<void>
  // Resets to the entry's tab root (modals cleared, stack popped). It does not reset scroll
  // position or a selected sub-tab: a setup step that scrolls or switches leaves that screen so
  // until the next reload. With `record`, the capture carries what the app's __kbE2ERecorder saw
  // from just before the entry navigated until it was captured.
  capture: (entry: TourEntry, opts?: {record?: boolean}) => Promise<Capture>
  // Restores the app (real Date, which takes a JS reload) and the device settings prepare changed,
  // then the device's own close.
  close: () => Promise<void>
  // What close would undo, as commands for a person to run when the process dies before close.
  cleanupCommands: () => Array<string>
}

export type Box = {bottom: number; left: number; right: number; top: number}

// What the device's operations can ask of the app.
export type AppHelpers = {
  appEval: <R>(body: string, what: string) => Promise<R>
  // waits for the testID in the focused screen or an overlay; true when all of it shows
  waitForTarget: (testID: string) => Promise<boolean>
  // the testID's rect in window points (focused screen or overlay), or null when it is missing
  targetBox: (testID: string) => Promise<Box | null>
  // whether a view with the testID is in the focused screen or an overlay
  targetPresent: (testID: string) => Promise<boolean>
}

export type NativeDevice = {
  // what Metro's inspector lists the app under
  inspectorDevice: string
  appId: string
  // what AccessibilityInfo must answer once prepareDevice's settings took (Reduce Transparency is
  // iOS only)
  reduceTransparency: boolean
  screenshot: () => Promise<Buffer>
  // Puts the device in the capture state (status bar, light appearance, reduced motion), noting
  // what it found so restoreDevice can put it back. True when a setting changed that the app reads
  // only at launch.
  prepareDevice: () => boolean
  restoreDevice: () => void
  // the app process, or undefined when it is not running
  appPid: () => number | undefined
  // stops and starts the app (the caller waits for its runtime)
  relaunch: () => Promise<void>
  click: (testID: string, h: AppHelpers) => Promise<void>
  longPress: (testID: string, box: Box, h: AppHelpers) => Promise<void>
  // scrolls a view that is in neither a list row nor a ScrollView into view
  scrollOther: (testID: string, h: AppHelpers) => Promise<void>
  // waits for a view with the testID to exist anywhere in the app
  waitForExist: (testID: string, timeoutMs: number, h: AppHelpers) => Promise<void>
  maskRects: (entry: TourEntry, h: AppHelpers) => Promise<Array<Rect>>
  // JS state a fresh runtime needs for captures, set after the clock is fixed (a reload undoes it)
  prepareRuntime: (h: AppHelpers) => Promise<void>
  // with the screen protector on, a capture checked to show none of the app; undefined on a device
  // whose screenshots the protector does not blank
  captureProtected?: (h: AppHelpers) => Promise<{png: Buffer; note?: string}>
  // throws when a capture cannot be the app's screen (a device's own check)
  checkCapture: (png: Buffer) => void
  // closes system UI over the app (Control Center, a notification shade)
  dismissSystemUi: () => Promise<void>
  // ends what the device opened for the session (an Appium session and server)
  end: () => Promise<void>
  // commands that undo prepareDevice and end, for a process that died before close; `prepared` is
  // whether prepareDevice ran
  cleanupCommands: (prepared: boolean) => Array<string>
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

const EVAL_MS = 5_000
// The app's inspector socket to Metro drops now and then while the app runs on; RN reconnects
// after 2s, then 4s and 8s, so this covers three tries.
const PAGE_MS = 15_000
const PAGE_POLL_MS = 500
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
const SCROLL_ATTEMPTS = 4
const TARGET_QUIET_MS = 300
// Longer than a Pressable's 500ms long press delay.

// Why a capture would not be the app's screen: system UI (Control Center, Notification Center, an
// alert) is over it, which deactivates the app's scene. Seen on the folded iPhone Duo, where a press
// under the status column at the right edge opened Control Center.
export const systemUiOverApp = (appState: string | undefined): string | undefined =>
  appState && appState !== 'active' ? `system UI is over the app (its AppState is ${appState}), so the screen is not the app's` : undefined

// How a capture that left the app broken (`why`) is first tried: a reload runs through the
// app's inspector page, so without one only a relaunch can help.
export const recoveryFor = (why: string): 'reload' | 'relaunch' => (lostInspectorPage(why) ? 'relaunch' : 'reload')

// A capture whose first error was a lost inspector page is taken once more only when the app lived
// through it (a socket drop): the same process, and in it the same JS runtime (the token the run last
// set, `tokenExpected`, read back as `tokenSeen`; null when the runtime has none, undefined when it
// could not be read). An app that died (crashed, was killed) or whose JS restarted keeps the entry
// failed, so a route that takes the app down is never hidden; so does a capture that failed for a
// reason of its own before the page went.
export const recaptureAfterDrop = (o: {
  firstError: string | undefined
  pidBefore: number | undefined
  pidAtDrop: number | undefined
  tokenExpected: string | undefined
  tokenSeen: string | null | undefined
}) =>
  lostInspectorPage(o.firstError) &&
  o.pidBefore !== undefined &&
  o.pidAtDrop === o.pidBefore &&
  o.tokenExpected !== undefined &&
  o.tokenSeen === o.tokenExpected

export type RecoverDeps = {
  routerAt: () => Promise<unknown>
  // whether the current capture lost the inspector page
  dropPending: () => boolean
  noteDrop: () => void
  // reads the app's runtime token once its page answers (once per drop); false when it doesn't
  readToken: () => Promise<boolean>
  runtimeRestarted: () => boolean
  reload: () => Promise<void>
  relaunch: () => Promise<void>
}

// Brings back an app a capture left broken, and says how, or undefined when nothing was. A screen
// that throws takes the navigator down with it (no navigation state) and every later capture would
// fail on that, so such an app is reloaded. A reload goes through the inspector page, so an app whose
// page is gone is relaunched instead; one a relaunch can't bring back stops the run, since every later
// capture would fail the same way. After a lost page the runtime is checked before the router: one
// that restarted has a router too, but none of what prepare set, so it is reloaded. The router and
// token reads are side-effect free, so they may run again; nothing else does.
export const recoverApp = async (d: RecoverDeps): Promise<string | undefined> => {
  let why = ''
  let step: 'reload' | 'relaunch' = 'reload'
  const also = (s: string) => {
    why = why ? `${why}; ${s}` : s
  }
  // with no drop yet, the router first: a lost page there is a drop, and goes on as one
  if (!d.dropPending()) {
    try {
      await d.routerAt()
      return undefined
    } catch (e) {
      why = (e as Error).message
      step = recoveryFor(why)
    }
    if (lostInspectorPage(why)) d.noteDrop()
  }
  if (d.dropPending()) {
    if (!(await d.readToken())) {
      also('the inspector page did not come back')
      step = 'relaunch'
    } else if (d.runtimeRestarted()) {
      also('the JS runtime restarted while the inspector page was gone')
      step = 'reload'
    } else {
      try {
        await d.routerAt()
        return undefined
      } catch (e) {
        const again = (e as Error).message
        also(why ? `once the page was back: ${again}` : again)
        step = recoveryFor(again)
      }
    }
  }
  if (step === 'reload') {
    try {
      await d.reload()
      return `the app was left broken (${why}) and was reloaded`
    } catch (e) {
      why = `${why}; the reload failed: ${(e as Error).message}`
    }
  }
  try {
    await d.relaunch()
  } catch (e) {
    throw new Error(`the app was left broken (${why}) and a relaunch did not bring it back: ${(e as Error).message}`, {cause: e})
  }
  return `the app was left broken (${why}) and was relaunched`
}

// Fixes Date at `at`, keeping React Native's Animated clock real. JS-driven Animated (timing,
// spring and decay without the native driver, e.g. SwitchToggle's on mount) reads its time from
// Date.now(), so under a fixed Date it never reaches its end: it updates the view every frame
// forever, and the busy main thread makes WDA's accessibility snapshots (the window rect, element
// queries) take seconds.
const fixClocks = (at: number) =>
  `(${fixDate.toString()})(${at});
   kbModule('node_modules/react-native/Libraries/Animated/AnimationTimingUtils.js')
     .setAnimationTimeProvider(() => globalThis.__kbVisualRealDate.now())`

const ROUTER = `const r = kbModule('constants/router.tsx');`
// The app's fibers (`roots`), read through the React DevTools hook a dev build has, with the walks
// and placements of coverage/visible.ts: screenPlacement says whether a view is in the focused
// screen, a hidden one (a hidden tab, a screen under the top one), or outside every screen (the
// overlays and sheets drawn over the navigator: the global error bar, popups).
const FIBERS = `
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (!hook?.getFiberRoots) throw new Error('no React DevTools hook; is this a dev build?')
  const roots = []
  for (const id of hook.renderers.keys()) for (const root of hook.getFiberRoots(id)) roots.push(root.current)
  ${VISIBLE_FUNCTIONS}
  // host views with a testID that keep accepts, in the order the walk meets them; with \`first\`,
  // only the first
  const hostsWithTestID = (keep, first) => {
    const out = []
    walkFibers(roots, f => {
      if (f.tag !== 5 || !f.memoizedProps?.testID || !keep(f)) return false
      out.push(f)
      return first
    })
    return out
  }
  // what the native placements need: host rects in window points, read synchronously (RN's DOM
  // API; a host view's public instance is made on demand, so one no ref asked for has none yet)
  let nativeEnv
  const env = () => {
    if (nativeEnv) return nativeEnv
    const renderer = kbModule('node_modules/react-native/Libraries/ReactNative/RendererImplementation.js')
    const dims = kbModule('node_modules/react-native/Libraries/Utilities/Dimensions.js')
    const win = (dims.default ?? dims).get('window')
    const rects = new Map()
    nativeEnv = {
      height: win.height,
      rect: f => {
        if (!rects.has(f)) {
          const r = renderer.getPublicInstanceFromInternalInstanceHandle(f)?.getBoundingClientRect?.()
          rects.set(f, r && {bottom: r.top + r.height, left: r.left, right: r.left + r.width, top: r.top})
        }
        return rects.get(f)
      },
      width: win.width,
    }
    return nativeEnv
  }`
// `hosts`: the host views in any screen that carry a testID
const HOSTS_WITH_TESTID = `${FIBERS}
  const hosts = hostsWithTestID(f => !!f.stateNode && screenPlacement(f) !== 'overlay', false).map(f => f.stateNode)`
// `target`: the host fiber with this testID in the focused screen, or else one outside every screen
// (an overlay or sheet), or undefined; `id` the testID
const findTarget = (testID: string) => `${FIBERS}
  const id = ${JSON.stringify(testID)}
  let overlay
  const target =
    hostsWithTestID(f => {
      if (f.memoizedProps.testID !== id) return false
      const at = screenPlacement(f)
      if (at === 'overlay') overlay ??= f
      return at === 'focused'
    }, true)[0] ?? overlay`
const targetByTestID = (testID: string) => `${findTarget(testID)}
  if (!target) throw new Error('no host view with testID ' + id + ' in the focused screen or an overlay')`
// 'missing' until the target is there, then 'inView' when all of it shows in the window, clipped by
// what scrolls it (or, for a target longer than that, when it fills it), else 'outside': desktop's
// scrollIntoViewIfNeeded scrolls a target that shows only in part, too.
export const targetState = (testID: string) => `${findTarget(testID)}
  if (!target) return 'missing'
  const r = env().rect(target)
  if (!r || !(r.right > r.left && r.bottom > r.top)) return 'outside'
  return showsAll(r, nativeClip(target, env())) ? 'inView' : 'outside'`
// The target's rect in window points, or null when it is missing.
export const targetBox = (testID: string) => `${findTarget(testID)}
  return target ? env().rect(target) ?? null : null`
// The call sites the capture draws (coverage/visible.ts), or null without coverage marks.
export const VISIBLE_SITES = `${FIBERS}
  const r = nativeVisibleSites(roots, env())
  return r.marks ? r.ids : null`
// Types into the text input at or under the host view with testID, through the native input's own
// onChangeText (and, for Enter, onSubmitEditing): XCUITest's typing into a controlled field that
// selects its text on focus drops and keeps characters unevenly. The native input is the host
// fiber that takes onChangeText: Kb.Input3 above it takes onEnterKeyDown, which it hands the native
// input as onSubmitEditing.
export const typeIntoTarget = (testID: string, text: string, enter: boolean) => `${targetByTestID(testID)}
  let input
  walkFibers([target], f => {
    if (f.tag === 5 && typeof f.memoizedProps?.onChangeText === 'function') input = f.memoizedProps
    return !!input
  })
  if (!input) throw new Error('no text input under testID ' + id)
  input.onChangeText(${JSON.stringify(text)})
  if (${enter}) {
    if (typeof input.onSubmitEditing !== 'function') throw new Error('the text input under testID ' + id + ' takes no Enter')
    input.onSubmitEditing({nativeEvent: {text: ${JSON.stringify(text)}}})
  }
`

// Scrolls the host view with this testID into the middle of what scrolls it, read off React's fiber
// tree as React DevTools does, walking up from the host fiber:
// - in a virtualized list row (a cell, whose props carry its index): the list (the first instance
//   above with scrollToIndex) centres that row;
// - otherwise in a ScrollView (its class instance): scrollTo the view's offset in the content,
//   measured synchronously (getBoundingClientRect, RN's DOM API) and clamped to the content.
// Both without animation. Returns 'row', 'scrollView', or 'none' when neither holds the view.
export const scrollToTarget = (testID: string) => `${targetByTestID(testID)}
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
export const STILL_VIDEOS = `${FIBERS}
  const isPlayer = v => !!v && typeof v === 'object' && typeof v.pause === 'function' && typeof v.replace === 'function' && 'currentTime' in v
  const players = new Set()
  walkFibers(roots, f => {
    if (f.tag !== 0 && f.tag !== 11 && f.tag !== 15) return
    for (let h = f.memoizedState; h && typeof h === 'object' && 'next' in h; h = h.next) {
      const v = h.memoizedState
      if (isPlayer(v)) players.add(v)
      else if (Array.isArray(v) && isPlayer(v[0])) players.add(v[0])
    }
  })
  for (const p of players) {
    try {
      p.pause()
      p.currentTime = 0
    } catch {}
  }
  return players.size`
const HOP_TAB = 'tabs.settingsTab'
const HOP_TAB_ALT = 'tabs.peopleTab'

export function openNative(dev: NativeDevice): NativeSession {
  const appEval = async <R,>(body: string, what: string) => {
    const page = await retryFor(async () => inspectorPageFor(dev.inspectorDevice, dev.appId), {intervalMs: PAGE_POLL_MS, ms: PAGE_MS, what})
    return withDeadline(evalInPage<R>(page, body), EVAL_MS, what)
  }
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
  const appPid = dev.appPid
  // The app process the run last started or found. When the current capture loses the inspector
  // page: the process then (read before any relaunch replaces it), the runtime token the run last set,
  // and the token the app answers with once the page is back.
  let knownPid: number | undefined
  let drop: {pid: number | undefined; tokenExpected: string; tokenSeen?: string | null} | undefined
  const noteDrop = () => {
    drop ??= {pid: appPid(), tokenExpected: runtimeToken}
  }
  // Reads the app's runtime token once its page answers, once per drop (a no-op once read, or with
  // no drop): false when the page does not answer.
  const readDropToken = async () => {
    const d = drop
    if (!d || d.tokenSeen !== undefined) return true
    try {
      const t = await retryFor(async () => appEval<unknown>('return globalThis.__kbVisualRuntime', 'reading the JS runtime token'), {
        intervalMs: PAGE_POLL_MS,
        ms: PAGE_MS,
        retryIf: whileLost,
      })
      d.tokenSeen = typeof t === 'string' ? t : null
      return true
    } catch {
      return false
    }
  }
  const runtimeRestarted = () => drop !== undefined && drop.tokenSeen !== drop.tokenExpected
  const relaunchApp = async () => {
    await markRuntime().catch(() => {})
    await appCmd(dev.relaunch(), 'relaunching the app')
    await waitForRuntime(true)
    knownPid = appPid()
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
    return !!got && got.reanimated && got.motion === true && (!dev.reduceTransparency || got.transparency === true)
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
  // A capture goes to its tab's root, then hops to another tab and back:
  // - the glass tab bar's rendering depends on which tab was selected before (seen live: files
  //   after chat differs from files after teams), so every capture arrives from the same tab;
  // - a screen an earlier capture pushed is popped on its own tab, before the hop (popped under the
  //   capture, its pop would change how the tab bar draws);
  // - the capture is never the first visit of the tab's screen: the native header lays its title
  //   out a fraction of a pixel off on a screen's first visit, and the visit before the hop makes
  //   every capture a later one. A remount (a fixture's) starts every tab's visits over, so a
  //   fixture capture visits every tab again after its remount (warmTabs) before the hop: a lone
  //   hop right after the remount left the native tab bar on the hop tab while the router had
  //   switched back, and the next push hung the app.
  // The switch back settles on screen before the capture goes on: a tab root captured right after
  // it drew its header title and the tab bar a little differently from one captured later.
  const toTabRoot = async (tab: string) => {
    let popped = !(await routerAt()).atRoot
    await appEval(`${ROUTER} r.clearModals()`, 'clearModals')
    await appEval(`${ROUTER} r.popStack()`, 'popStack')
    await waitFor('the current tab to be at its root', RESET_MS, async () => (await routerAt()).atRoot)
    // a switch made while that dismissal still runs can be dropped too (seen on an Android phone
    // after a modal), so it settles first
    if (popped) await settle(screenshot, SETTLE)
    await switchTo(tab)
    popped ||= !(await routerAt()).atRoot
    await appEval(`${ROUTER} r.popStack()`, 'popStack')
    await waitFor(`the root of ${tab}`, RESET_MS, async () => (await routerAt()).atRoot)
    // The router is at the root at once, but a native pop or modal dismissal runs on after it, and
    // the native tab bar drops a tab switch made while one runs (seen after
    // chat/attachment-fullscreen's modal: the hop's switch never took), so it ends before the hop.
    if (popped) await settle(screenshot, SETTLE)
  }
  const hopBack = async (tab: string) => {
    await switchTo(tab === HOP_TAB ? HOP_TAB_ALT : HOP_TAB)
    await settle(screenshot, SETTLE)
    await switchTo(tab)
    await settle(screenshot, SETTLE)
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

  // Waits for the step's target in the focused screen or an overlay (a device's own lookup by testID
  // would also find another screen's), and says whether all of it shows (targetState).
  const waitForTarget = async (testID: string) => {
    let state = 'missing'
    await waitFor(`${testID} in the focused screen or an overlay`, SETUP_MS, async () => {
      state = await appEval<string>(targetState(testID), `finding ${testID}`)
      return state !== 'missing'
    })
    return state === 'inView'
  }

  const helpers: AppHelpers = {
    appEval,
    targetBox: async testID => appEval<Box | null>(targetBox(testID), `measuring ${testID}`),
    targetPresent: async testID => (await appEval<string>(targetState(testID), `finding ${testID}`)) !== 'missing',
    waitForTarget,
  }

  const runStep = async (s: SetupStep) => {
    switch (s.kind) {
      case 'openPopup':
      case 'switchSubTab':
      case 'click':
        await withDeadline(dev.click(s.testID, helpers), SETUP_MS, `${s.kind} ${s.testID}`)
        return
      case 'type':
        await waitForTarget(s.testID)
        await appEval(typeIntoTarget(s.testID, s.text, !!s.enter), `typing into ${s.testID}`)
        return
      case 'searchThread': {
        await withDeadline(dev.waitForExist(CHAT_MESSAGE_LIST, SETUP_MS, helpers), SETUP_MS + 1_000, 'the conversation')
        const ok = await appEval<boolean>(
          `${ROUTER} const v = r.getVisibleScreen()
           return !!v?.params?.conversationIDKey && r.setRouteParams(v.key, {threadSearch: ${JSON.stringify(s.query ? {query: s.query} : {})}})`,
          'opening thread search'
        )
        if (!ok) throw new Error('searchThread: no open conversation to search')
        return
      }
      case 'scrollIntoView': {
        // waits for the element, as desktop's scrollIntoViewIfNeeded does, so the step can gate
        // later steps on something that loads; one that shows only in part is scrolled too
        if (await waitForTarget(s.testID)) return
        // Appium's \`mobile: scroll\` gives up on the inverted chat thread (and can wedge WDA), so what
        // scrolls the element is scrolled from JS where it can be (scrollToTarget); only an element
        // in neither a list row nor a ScrollView is left to the device.
        // A scroll lands where the list's row heights put the target, and rows not measured yet
        // (or still laying out, an image arriving) move it after: the scroll is repeated, each
        // time once the target has stopped moving, until a scroll leaves it where the one before
        // did.
        let landed = ''
        for (let attempt = 0; attempt < SCROLL_ATTEMPTS; attempt++) {
          const how = await appEval<'row' | 'scrollView' | 'none'>(scrollToTarget(s.testID), `scrolling to ${s.testID}`)
          if (how === 'none') {
            await withDeadline(dev.scrollOther(s.testID, helpers), SETUP_MS, `scrolling to ${s.testID}`)
            return
          }
          let box = ''
          await waitForQuiet(`${s.testID} to stop moving`, SETUP_MS, TARGET_QUIET_MS, async () => {
            const next = JSON.stringify(await appEval<unknown>(targetBox(s.testID), `measuring ${s.testID}`))
            const same = next === box
            box = next
            return same
          })
          if (box === landed) return
          landed = box
        }
        throw new Error(`scrollIntoView ${s.testID}: the target still moved after ${SCROLL_ATTEMPTS} scrolls`)
      }
      case 'hover':
        throw new Error(`hover ${s.testID}: hover is desktop only`)
      case 'longPress': {
        // pressed at its centre in window points, so it is the focused screen's view (a device's
        // own lookup by testID would also find another screen's)
        if (!(await waitForTarget(s.testID))) throw new Error(`longPress ${s.testID}: not all of it shows; scroll it into view first`)
        const box = await helpers.targetBox(s.testID)
        if (!box) throw new Error(`longPress ${s.testID}: it went before it could be pressed`)
        await withDeadline(dev.longPress(s.testID, box, helpers), SETUP_MS, `long pressing ${s.testID}`)
        return
      }
    }
  }

  const screenshot = async () => withDeadline(dev.screenshot(), EVAL_MS, 'taking a screenshot')

  // Visits every tab once (an iPad's tablet tabs, else the phone tabs). A tab's first visit after a
  // reload lays its header title out a fraction of a pixel off from every later visit (stable either
  // way), so captures are only comparable when none of them is a first visit.
  const warmTabs = async () => {
    const tabs = await appEval<Array<string>>(
      `const t = kbModule('constants/tabs.tsx')
       return kbModule('constants/platform.tsx').isTablet ? t.tabletTabs : t.phoneTabs`,
      'reading the tabs'
    )
    for (const tab of tabs) {
      await switchTo(tab)
      await waitForNoLoading()
      await settle(screenshot, SETTLE)
    }
  }

  // Screens mounted before Date was fixed (the restored tab, anything memoized at boot) rendered
  // with the real time. Resetting the navigation root to its own state without route keys gives
  // every route a new key, so every screen remounts under the fixed Date. Checked: no host view
  // in a screen that carried a testID before the reset is still mounted after it. Then what the
  // remounted screens load settles.
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
    await waitForNoLoading()
  }

  const coverageVisible = async () => appEval<Array<string> | null>(VISIBLE_SITES, 'reading the visible coverage marks')

  let prepared = false
  let datePatched = false
  let frozenAt: number | undefined
  // whether prepareDevice ran, so close puts the device back
  let devicePrepared = false
  const reducedWhat = dev.reduceTransparency ? 'Reduce Motion and Reduce Transparency' : 'reduced motion'

  const prepare: NativeSession['prepare'] = async p => {
    if (p.theme !== 'light') throw new Error(`phone captures are light only (asked for ${p.theme})`)
    devicePrepared = true
    const changed = dev.prepareDevice()
    await waitForRuntime(false)
    if (changed || !(await accessibilityOn())) await relaunchApp()
    else if (p.reload) await reloadJs()
    if (!(await accessibilityOn())) throw new Error(`the app does not report ${reducedWhat} after a relaunch`)
    await appEval(fixClocks(p.frozenAt), 'fixing Date')
    datePatched = true
    frozenAt = p.frozenAt
    await applyLight()
    await dev.prepareRuntime(helpers)
    await remountScreens()
    const now = await appEval<number>('return Date.now()', 'reading Date.now')
    if (now !== p.frozenAt) throw new Error(`Date is not fixed in the app: Date.now() is ${now}, wanted ${p.frozenAt}`)
    await warmTabs()
    // a capture that loses the inspector page compares the runtime with this mark
    await markRuntime()
    knownPid = appPid()
    prepared = true
  }

  // The state prepare leaves on a fresh JS runtime.
  const restorePrepared = async (at: number) => {
    await appEval(fixClocks(at), 'fixing Date')
    await applyLight()
    await dev.prepareRuntime(helpers)
    await remountScreens()
    await warmTabs()
    await markRuntime()
  }
  const reloadPrepared = async (at: number) => {
    await reloadJs()
    await restorePrepared(at)
  }
  const relaunchPrepared = async (at: number) => {
    await relaunchApp()
    if (!(await accessibilityOn())) throw new Error(`the app does not report ${reducedWhat} after a relaunch`)
    await restorePrepared(at)
  }
  const recoverIfBroken = async (): Promise<string | undefined> => {
    if (frozenAt === undefined) return undefined
    const at = frozenAt
    return recoverApp({
      dropPending: () => drop !== undefined,
      noteDrop,
      readToken: readDropToken,
      relaunch: async () => relaunchPrepared(at),
      reload: async () => reloadPrepared(at),
      routerAt,
      runtimeRestarted,
    })
  }

  // ---------------------------------------------------------------- fixtures (fixtures/runtime.ts)

  // How a capture's fixture (fixtures/drive.mts) reaches the app and puts it back after end().
  const fixtureHooks: FixtureHooks = {
    evalApp: appEval,
    reload: async () => {
      if (frozenAt === undefined) throw new Error('a fixture ended before prepare')
      await reloadPrepared(frozenAt)
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

  const startRecorder = async () => startPhoneRecorder(async <R,>(b: string) => appEval<R>(b, 'starting the route and RPC recorder'))
  const takeRecorder = async (startedIn: string) =>
    takePhoneRecorder(async <R,>(b: string) => appEval<R>(b, 'taking the route and RPC recording'), startedIn)

  const appStateNow = async () =>
    appEval<string>(
      `const m = kbModule('node_modules/react-native/Libraries/AppState/AppState.js')
       return (m.default ?? m).currentState`,
      'reading the AppState'
    )
  // Closes system UI left over the app (an earlier entry's touch may have opened it), so it covers
  // no later entry
  const dismissSystemUi = async () => withDeadline(dev.dismissSystemUi(), SETUP_MS, 'closing system UI over the app')

  const captureOnce = async (
    entry: TourEntry,
    opts: {record?: boolean} | undefined
  ): Promise<{result: Capture; firstError: string | undefined}> => {
    drop = undefined
    let png: Buffer | undefined
    let recordingIn: string | undefined
    const fixture = fixtureCapture(fixtureHooks, entry.fixture)
    let result: Capture
    try {
      if (!prepared) throw new Error('capture called before prepare')
      if (systemUiOverApp(await appStateNow())) await dismissSystemUi()
      await fixture.assertNoneActive()
      const {tab} = entry.nav
      await toTabRoot(tab)
      if (entry.fixture) {
        // installed on an idle app; then every screen remounts so none keeps live data, and the
        // visits come after the remount
        await waitForNoLoading()
        await fixture.begin()
        await remountScreens()
        await warmTabs()
      }
      await hopBack(tab)
      // the tab root's own loads finish before the entry navigates from it
      if (waitsAtTabRoot(entry)) await waitForNoLoading()
      // started after the hop, which would otherwise record the hop's tabs as the entry's routes
      if (opts?.record) recordingIn = await startRecorder()
      const nav = await resolveParams(entry.nav)
      if (nav.thread) {
        await appEval(`${ROUTER} r.navigateToThread(${JSON.stringify(nav.thread)}, 'misc')`, 'navigateToThread')
      }
      const append = nav.append
      if (append) {
        const ok = await appEval<boolean>(
          `${ROUTER} return r.navigateAppend(${JSON.stringify({name: append.name, params: append.params})})`,
          `navigateAppend ${append.name}`
        )
        if (!ok) throw new Error(`navigateAppend ${append.name} did not navigate`)
      }
      if (entry.setup?.length) {
        await waitForNoLoading()
        for (const s of entry.setup) await runStep(s)
      }
      await dev.waitForExist(entry.ready, READY_MS, helpers)
      await fixture.ready()
      await waitForNoLoading()
      // An auto-focused input blinks its caret, so a capture could catch either phase. Desktop
      // screenshots hide the caret; a phone can't, so the input loses focus instead.
      await appEval(
        `const m = kbModule('node_modules/react-native/Libraries/Components/TextInput/TextInputState.js')
         const S = m.default ?? m
         const focused = S.currentlyFocusedInput()
         if (focused) S.blurTextInput(focused)`,
        'blurring the focused input'
      )
      await appEval(STILL_VIDEOS, 'pausing videos on their first frame')
      const covered = systemUiOverApp(await appStateNow())
      if (covered) throw new Error(covered)
      if (entry.screenProtector) {
        if (!dev.captureProtected) throw new Error(`${entry.id}: a screen protector entry runs on Android only`)
        const shot = await withDeadline(dev.captureProtected(helpers), SETUP_MS, 'capturing with the screen protector on')
        png = shot.png
        result = {coverage: null, masks: [], png, status: 'ok', ...(shot.note ? {note: shot.note} : {})}
      } else {
        const settled = await settle(async () => {
          png = await screenshot()
          return png
        }, CAPTURE_SETTLE)
        png = settled.png
        dev.checkCapture(png)
        const masks = await dev.maskRects(entry, helpers)
        const coverage = await coverageVisible()
        result = {coverage, masks, png, status: settled.stable ? 'ok' : 'unstable'}
      }
    } catch (e) {
      // what was on screen when it failed, for the card; none when even that fails
      png ??= await screenshot().catch(() => undefined)
      result = {coverage: null, error: (e as Error).message, masks: [], png: png ?? Buffer.alloc(0), status: 'failed'}
    }
    const problems: Array<string> = []
    // taken before the fixture ends: a fixture's end may reload the app
    if (recordingIn !== undefined) {
      try {
        const recorded = recordingFrom(recordingIn, await takeRecorder(recordingIn))
        if (recorded) result = {...result, recorded}
        else problems.push('the app reloaded during the capture, which dropped its route and RPC recording')
      } catch (e) {
        problems.push(`taking the recording: ${(e as Error).message}`)
      }
    }
    problems.push(...(await fixture.end()))
    if (lostInspectorPage(result.error ?? problems[0])) noteDrop()
    // a fixture's end can leave the navigator without state too, so this runs after every capture
    const recovered = await recoverIfBroken()
    if (recovered) problems.push(recovered)
    // after a reload or relaunch this reads that new runtime, which keeps the entry failed
    await readDropToken()
    const firstError = result.error ?? problems[0]
    if (problems.length) {
      const why = problems.join('; ')
      result = {...result, error: result.error ? `${result.error}; ${why}` : why, status: 'failed'}
    }
    return {firstError, result}
  }
  const capture: NativeSession['capture'] = async (entry, opts) => {
    const pidBefore = knownPid
    const {result: first, firstError} = await captureOnce(entry, opts)
    const seen = drop
    if (
      first.status !== 'failed' ||
      !recaptureAfterDrop({firstError, pidAtDrop: seen?.pid, pidBefore, tokenExpected: seen?.tokenExpected, tokenSeen: seen?.tokenSeen})
    )
      return first
    const {result: second} = await captureOnce(entry, opts)
    return second.status === 'failed'
      ? {...second, error: `${second.error ?? 'no error given'}; captured again after the inspector page dropped, which failed first with: ${first.error}`}
      : {...second, note: `recaptured after the inspector page dropped: ${first.error}`}
  }

  const close: NativeSession['close'] = async () => {
    try {
      if (datePatched) {
        datePatched = false
        await reloadJs()
      }
    } finally {
      if (devicePrepared) {
        try {
          dev.restoreDevice()
        } catch {}
      }
      await dev.end()
    }
  }

  const cleanupCommands = () => dev.cleanupCommands(devicePrepared)

  return {capture, cleanupCommands, close, prepare}
}
