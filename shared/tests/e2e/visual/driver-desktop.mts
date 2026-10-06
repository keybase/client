// Captures tour entries from the running dev Electron app over CDP. Navigation goes through the dev
// global DEBUGRouter2 only, and the app's other windows open through the main window's preload
// functions and remote actions (openWindow); the driver never clicks anything that changes account
// state, and never closes the browser (that quits Electron).
import {execFileSync} from 'child_process'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {chromium, type Browser, type BrowserContext, type CDPSession, type Page} from '@playwright/test'
import {findMainPage, checkRendererAfterReload} from '../electron/helpers/connect.ts'
import {CHAT_MESSAGE_LIST} from '../shared/test-ids.ts'
import {pngEqual, type Rect} from './compare.mts'
import {resolveParams, resolveValue} from './resolve.mts'
import {VISUAL_CAPTURE_ARGS, VISUAL_VIEWPORT} from './electron-args.ts'
import type {RemoteWindow, Theme, TourEntry, SetupStep, WindowSize} from './tour-types.ts'
import {fixtureCapture, type FixtureHooks} from './fixtures/drive.mts'
import type {Coverage} from './coverage/registry.ts'
import type {VisualFixtures} from './fixtures/runtime.ts'

export type Capture = {
  png: Buffer
  masks: Array<Rect>
  coverage: Array<string> | null
  status: 'ok' | 'unstable' | 'failed'
  error?: string
}
// `chrome` is the `__chrome__` coverage pseudo-entry: the call sites mounted after the reload, at
// the first tab root, once the waiting store is idle. Null without a reload or without coverage
// marks.
export type Prepared = {chrome: Array<string> | null}
export type DesktopSession = {
  prepare: (opts: {theme: Theme; frozenAt: number; reload: boolean}) => Promise<Prepared>
  capture: (entry: TourEntry) => Promise<Capture>
  // Restores the app and detaches this driver's CDP session. It does not close the browser (that
  // quits Electron), so the Playwright connection stays open: the caller must exit its process,
  // under its own deadline, to drop it.
  close: () => Promise<void>
  // What close would undo, as commands for a person to run when the process dies before close.
  cleanupCommands: () => Array<string>
}

// The renderer keeps the fixed Date and the in-memory dark mode preference 'system' until it
// reloads; relaunching the app reloads it.
export const desktopCleanupCommands = (shared: string): Array<string> => [
  `cd ${shared} && node tests/e2e/electron/launch-app.mts --visual   # or reload the Keybase window (Cmd+R)`,
]

const SHARED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const DEVICE_SCALE_FACTOR = 2
const VIEWPORT = {deviceScaleFactor: DEVICE_SCALE_FACTOR, ...VISUAL_VIEWPORT}
const CONNECT_MS = 5_000
const EVAL_MS = 5_000
const RESET_MS = 5_000
const READY_MS = 10_000
const CHAT_TAB = 'tabs.chatTab'
const SETUP_MS = 5_000
const ASSETS_MS = 10_000
const SETTLE = {deadlineMs: 5_000, intervalMs: 250}
const POLL_MS = 100
export const IDLE_QUIET_MS = 500

// Desktop loading indicators that carry a marker. Kb.ProgressIndicator (a lottie spinner) has none;
// a spinner still on screen keeps changing frames, so settle reports it as unstable.
export const LOADING_SELECTORS: ReadonlyArray<string> = ['.loading-line']

// macOS overlay scrollbars fade in and out with scrolling (the chat thread scrolls itself to the end
// as it loads), so a screenshot can catch the thumb at any opacity. Overlay scrollbars take no
// layout space, so hiding them changes nothing else. Classic scrollbars (the app marks the body
// layout-scrollbar-obtrusive) take space and don't fade; they stay in the capture.
const HIDE_OVERLAY_SCROLLBARS = '* { scrollbar-width: none !important; }'

export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const withDeadline = async <T,>(p: Promise<T>, ms: number, what: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${what}: no answer in ${ms / 1000}s`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export const waitFor = async (what: string, ms: number, check: () => Promise<boolean>) => {
  const start = Date.now()
  for (;;) {
    if (await check()) return
    if (Date.now() - start > ms) throw new Error(`timed out after ${ms / 1000}s waiting for ${what}`)
    await sleep(POLL_MS)
  }
}

// Like waitFor, but the check must hold for quietMs in a row: a screen's loaders start from effects
// that run after its first paint, so a single idle reading can come before the first one starts.
export const waitForQuiet = async (what: string, ms: number, quietMs: number, idle: () => Promise<boolean>) => {
  let since: number | undefined
  await waitFor(what, ms, async () => {
    if (!(await idle())) {
      since = undefined
      return false
    }
    since ??= Date.now()
    return Date.now() - since >= quietMs
  })
}

export async function settle(
  snap: () => Promise<Buffer>,
  opts: {deadlineMs: number; intervalMs: number}
): Promise<{png: Buffer; stable: boolean}> {
  const start = Date.now()
  let prev = await snap()
  for (;;) {
    await sleep(opts.intervalMs)
    const next = await snap()
    if (pngEqual(prev, next)) return {png: next, stable: true}
    prev = next
    if (Date.now() - start > opts.deadlineMs) return {png: next, stable: false}
  }
}

type Router = {
  clearModals: () => void
  switchTab: (t: string) => void
  popStack: () => void
  navigateAppend: (p: {name: string; params?: object}) => boolean
  getTab: () => string | undefined
  navigateToThread: (conversationIDKey: string, reason: string) => void
  setChatRootParams: (p: {conversationIDKey?: string; infoPanel?: undefined; threadSearch?: {query: string} | undefined}) => boolean
  getVisibleScreen: () => {params?: {conversationIDKey?: string}} | undefined
}
type NavState = {routes?: Array<{name: string; state?: NavState}>}
type DarkStore = {
  getState: () => {darkModePreference: string; isDarkMode: () => boolean}
  setState: (p: {darkModePreference: string}) => void
}
// The shared tsconfig has no DOM lib (react-native), so page-side code describes what it touches.
type PageImage = {
  complete: boolean
  naturalWidth: number
  currentSrc: string
  src: string
  getBoundingClientRect: () => {bottom: number; height: number; left: number; right: number; top: number; width: number}
}
type PageVideo = {
  autoplay: boolean
  currentTime: number
  paused: boolean
  readyState: number
  pause: () => void
  addEventListener: (event: 'loadeddata' | 'seeked', f: () => void, o: {once: true}) => void
}
type PageWindow = {
  document: {
    body: {classList: {contains: (c: string) => boolean}}
    querySelectorAll: (sel: 'video') => ArrayLike<PageVideo>
    fonts: {ready: Promise<unknown>}
    images: ArrayLike<PageImage>
  }
  getComputedStyle: (el: PageImage) => {visibility: string}
  innerHeight: number
  innerWidth: number
  devicePixelRatio: number
}
type DateGlobals = {Date: DateConstructor; __kbVisualRealDate?: DateConstructor; __kbVisualNow?: number}
type WaitingStore = {getState: () => {counts: Map<string, number>}}
type ConfigStore = {getState: () => {windowShownCount: Map<string, number>}}
// The preload's functions (desktop/renderer/preload.desktop.tsx) the driver calls in the main window.
type PreloadFunctions = {
  closeRenderer: (o: {windowComponent: string; windowParam: string}) => void
  getRemoteProps: (windowComponent: string, windowParam: string) => Promise<string>
  mainWindowDispatch: (action: {type: string; payload: object}) => void
  makeRenderer: (o: {windowComponent: string; windowOpts: object; windowParam: string}) => void
  rendererNewProps: (o: {propsStr: string; windowComponent: string; windowParam: string}) => void
}
type DevGlobals = {
  DEBUGRouter2?: Router
  DEBUGNavigator?: {getRootState: () => NavState | undefined; resetRoot: (s: unknown) => void}
  __kbVisualFixtures?: VisualFixtures
  __ZUSTAND_HMR__?: Map<string, unknown>
  __kbVisualCoverage?: Coverage
  _fromPreload?: {functions: PreloadFunctions}
}

// Where the router is: the current tab, and whether that tab is at its root (its stack holds one
// screen and nothing, modal or otherwise, sits on the root stack above the tabs). A nested
// sub-tab navigator under the root screen (settings, crypto) keeps its selected sub-tab.
const routerAt = async (page: Page) =>
  withDeadline(
    page.evaluate(() => {
      const g = globalThis as unknown as DevGlobals
      const r = g.DEBUGRouter2
      const root = g.DEBUGNavigator?.getRootState()
      if (!r || !root) throw new Error('DEBUGRouter2/DEBUGNavigator are not defined; is this a dev build?')
      const tab = r.getTab()
      const tabRoute = root.routes?.[0]?.state?.routes?.find(x => x.name === tab)
      const stackDepth = tabRoute?.state?.routes?.length ?? 1
      return {atRoot: root.routes?.length === 1 && stackDepth === 1, tab}
    }),
    EVAL_MS,
    'reading the router state'
  )

const routerCall = async (page: Page, step: 'clearModals' | 'switchTab' | 'popStack' | 'closeChatRootPanels', tab = '') =>
  withDeadline(
    page.evaluate(
      ([s, t]) => {
        const r = (globalThis as unknown as DevGlobals).DEBUGRouter2
        if (!r) throw new Error('DEBUGRouter2 is not defined; is this a dev build?')
        if (s === 'switchTab') r.switchTab(t)
        else if (s === 'closeChatRootPanels') r.setChatRootParams({infoPanel: undefined, threadSearch: undefined})
        else r[s]()
      },
      [step, tab] as const
    ),
    EVAL_MS,
    `DEBUGRouter2.${step}`
  )

const resetTo = async (page: Page, tab: string) => {
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await routerCall(page, 'clearModals')
  await routerCall(page, 'switchTab', tab)
  await waitFor(`tab ${tab} to be current`, RESET_MS, async () => (await routerAt(page)).tab === tab)
  await routerCall(page, 'popStack')
  await waitFor(`the root of ${tab}`, RESET_MS, async () => (await routerAt(page)).atRoot)
  // The info panel and thread search are params of the chat root, which navigateToThread merges
  // into rather than replaces, so an entry that opened one would leave it open for every
  // conversation after it.
  if (tab === CHAT_TAB) await routerCall(page, 'closeChatRootPanels')
}

// ---------------------------------------------------------------- fixtures (fixtures/runtime.ts)

// Screens mounted before the fixture began hold live data in their state. Resetting the root to its
// own state without route keys gives every route a new key, so every screen remounts.
const remountScreens = async (page: Page) => {
  type S = {index?: number; routes: Array<{name: string; params?: unknown; state?: S}>}
  await withDeadline(
    page.evaluate(() => {
      const nav = (globalThis as unknown as DevGlobals).DEBUGNavigator
      if (!nav) throw new Error('DEBUGNavigator is not defined; is this a dev build?')
      const strip = (x: S | undefined): S | undefined =>
        x && {index: x.index, routes: x.routes.map(r => ({name: r.name, params: r.params, state: strip(r.state)}))}
      nav.resetRoot(strip(nav.getRootState() as S | undefined))
    }),
    EVAL_MS,
    'remounting every screen'
  )
  await waitForNoLoading(page)
}

// How a capture's fixture (fixtures/drive.mts) reaches the app and puts it back after end().
const fixtureHooks = (page: Page): FixtureHooks => ({
  evalApp: async <R,>(body: string, what: string) => withDeadline(page.evaluate(`(() => {${body}})()`) as Promise<R>, EVAL_MS, what),
  reload: async () => {
    await withDeadline(page.reload(), READY_MS, 'reloading after the fixture')
    await checkRendererAfterReload(page)
    await waitForNoLoading(page)
  },
  remount: async () => {
    // a remount of a state holding a pushed screen can leave the navigator with no state (seen on
    // the phone with the device page), so the reset to the tab root comes first
    await routerCall(page, 'clearModals')
    await routerCall(page, 'popStack')
    await waitFor('the current tab to be at its root', RESET_MS, async () => (await routerAt(page)).atRoot)
    await remountScreens(page)
  },
  waitFor: async (what, check) => waitFor(what, READY_MS, check),
})

const runStep = async (page: Page, s: SetupStep) => {
  if (s.kind === 'searchThread') {
    // the conversation must be up first: its search param on a chat root still loading the
    // conversation throws in the thread (no ConversationThreadProvider yet)
    await page.getByTestId(CHAT_MESSAGE_LIST).locator('visible=true').first().waitFor({state: 'visible', timeout: SETUP_MS})
    const ok = await withDeadline(
      page.evaluate(query => {
        const r = (globalThis as unknown as DevGlobals).DEBUGRouter2
        if (!r) throw new Error('DEBUGRouter2 is not defined; is this a dev build?')
        const conversationIDKey = r.getVisibleScreen()?.params?.conversationIDKey
        return !!conversationIDKey && r.setChatRootParams({conversationIDKey, threadSearch: {query}})
      }, s.query),
      EVAL_MS,
      'opening thread search'
    )
    if (!ok) throw new Error('searchThread: no open conversation to search')
    return
  }
  const target = page.getByTestId(s.testID).locator('visible=true').first()
  switch (s.kind) {
    case 'openPopup':
    case 'switchSubTab':
    case 'click':
      await target.click({timeout: SETUP_MS})
      return
    case 'type': {
      // the testID marks the input or a box holding it
      const input = target.locator('css=input, textarea').or(target.and(page.locator('css=input, textarea'))).first()
      await input.fill(s.text, {timeout: SETUP_MS})
      if (s.enter) await input.press('Enter', {timeout: SETUP_MS})
      return
    }
    case 'scrollIntoView':
      await target.scrollIntoViewIfNeeded({timeout: SETUP_MS})
      return
    case 'hover':
      await target.hover({timeout: SETUP_MS})
      return
  }
}

// Images that are rendered inside the viewport but not decoded yet. Lazy images outside the
// viewport never load, so they count as hidden.
const pendingImages = async (page: Page) =>
  withDeadline(
    page.evaluate(() => {
      const w = globalThis as unknown as PageWindow
      return Array.from(w.document.images)
        .filter(img => {
          if (img.complete && img.naturalWidth > 0) return false
          const r = img.getBoundingClientRect()
          const shown = r.width > 0 && r.height > 0 && w.getComputedStyle(img).visibility !== 'hidden'
          const inView = r.bottom > 0 && r.right > 0 && r.top < w.innerHeight && r.left < w.innerWidth
          return shown && inView
        })
        .map(img => img.currentSrc || img.src)
    }),
    EVAL_MS,
    'listing images'
  )

const waitForAssets = async (page: Page) => {
  await withDeadline(
    page.evaluate(async () => {
      await (globalThis as unknown as PageWindow).document.fonts.ready
    }),
    ASSETS_MS,
    'document.fonts.ready'
  )
  let pending: Array<string> = []
  try {
    await waitFor('images to load', ASSETS_MS, async () => {
      pending = await pendingImages(page)
      return pending.length === 0
    })
  } catch (e) {
    throw new Error(`${(e as Error).message}: ${pending.slice(0, 5).join(', ')}`, {cause: e})
  }
}

// A looping autoplay video (a giphy unfurl) shows a different frame on every screenshot. Each one
// is paused on its first frame; videos that don't play on their own are left as they are.
const stillVideos = async (page: Page) =>
  withDeadline(
    page.evaluate(async () => {
      const w = globalThis as unknown as PageWindow
      const playing = Array.from(w.document.querySelectorAll('video')).filter(v => v.autoplay || !v.paused)
      await Promise.all(
        playing.map(
          async v =>
            new Promise<void>(resolve => {
              v.pause()
              const decoded = () => {
                if (v.readyState >= 2) resolve()
                else v.addEventListener('loadeddata', resolve, {once: true})
              }
              if (v.currentTime === 0) {
                decoded()
              } else {
                v.addEventListener('seeked', decoded, {once: true})
                v.currentTime = 0
              }
            })
        )
      )
    }),
    ASSETS_MS,
    'pausing autoplay videos on their first frame'
  )

// Nothing in flight in the app's waiting store (the keys its RPC loaders hold while they fetch; the
// main window makes every RPC, a remote window's too), and no marked loading indicator on `shown`.
const waitForNoLoading = async (page: Page, shown: Page = page) => {
  let busy: Array<string> = []
  try {
    await waitForQuiet('the waiting store to be idle', READY_MS, IDLE_QUIET_MS, async () => {
      busy = await withDeadline(
        page.evaluate(() => {
          const store = (globalThis as unknown as DevGlobals).__ZUSTAND_HMR__?.get('waiting') as WaitingStore | undefined
          if (!store) throw new Error('the waiting store is not in __ZUSTAND_HMR__; is this a dev build?')
          return Array.from(store.getState().counts.keys())
        }),
        EVAL_MS,
        'reading the waiting store'
      )
      return busy.length === 0
    })
  } catch (e) {
    throw new Error(`${(e as Error).message}: ${busy.join(', ')}`, {cause: e})
  }
  for (const sel of LOADING_SELECTORS) {
    await waitFor(`no visible ${sel}`, READY_MS, async () => {
      const all = await shown.locator(sel).all()
      for (const l of all) if (await l.isVisible()) return false
      return true
    })
  }
}

const maskRects = async (page: Page, entry: TourEntry, dpr: number) => {
  const rects: Array<Rect> = []
  for (const m of entry.masks ?? []) {
    const all = await page.getByTestId(m.testID).all()
    const boxes = (await Promise.all(all.map(async l => l.boundingBox({timeout: SETUP_MS})))).filter(b => !!b)
    if (boxes.length === 0) throw new Error(`mask target ${m.testID} is not on screen`)
    for (const b of boxes) rects.push({height: b.height * dpr, width: b.width * dpr, x: b.x * dpr, y: b.y * dpr})
  }
  return rects
}

// Replaces Date so that `new Date()` and `Date.now()` return `now`; timers keep running. Runs in the
// page, both on the live document and before every new one (the iOS driver runs it through Metro
// after each reload). Only Date: Playwright's clock.install +
// pauseAt also freezes setTimeout and requestAnimationFrame, and the renderer then never finishes
// booting after a reload.
export const fixDate = (now: number) => {
  const g = globalThis as unknown as DateGlobals
  g.__kbVisualNow = now
  if (g.__kbVisualRealDate) return
  const Real = g.Date
  g.__kbVisualRealDate = Real
  const current = () => g.__kbVisualNow ?? Real.now()
  function FixedDate(...args: Array<number | string>) {
    // Date() without new returns a string; the types say new.target is always set
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!new.target) return new Real(current()).toString()
    return args.length === 0 ? new Real(current()) : new (Real as unknown as new (...a: Array<number | string>) => Date)(...args)
  }
  FixedDate.prototype = Real.prototype
  FixedDate.now = current
  FixedDate.parse = Real.parse
  FixedDate.UTC = Real.UTC
  g.Date = FixedDate as unknown as DateConstructor
}

const coverageSeq = async (page: Page) =>
  withDeadline(
    page.evaluate(() => (globalThis as unknown as DevGlobals).__kbVisualCoverage?.seq() ?? null),
    EVAL_MS,
    'coverage seq'
  )

const coverageMounted = async (page: Page) =>
  withDeadline(
    page.evaluate(() => (globalThis as unknown as DevGlobals).__kbVisualCoverage?.mounted() ?? null),
    EVAL_MS,
    'coverage mounted'
  )

// What the capture shows of what its entry mounted: the call sites mounted after `seq` that are
// still mounted now.
const coverageNowSince = async (page: Page, seq: number | null) =>
  seq === null
    ? null
    : withDeadline(
        page.evaluate(s => {
          const c = (globalThis as unknown as DevGlobals).__kbVisualCoverage
          if (!c) return null
          if (typeof c.mountedNowSince !== 'function') {
            throw new Error('the app records coverage without capture-time sites; serve a tree whose coverage/registry.ts has mountedNowSince')
          }
          return c.mountedNowSince(s)
        }, seq),
        EVAL_MS,
        'coverage mountedNowSince'
      )

// Electron implements neither Browser.getWindowForTarget nor Browser.setWindowBounds, so the
// viewport and pixel ratio are emulated: captures don't depend on the window size or display the
// user left. The override lasts while this CDP session is attached.
const fixViewport = async (cdp: CDPSession, page: Page, viewport: typeof VIEWPORT = VIEWPORT) => {
  await withDeadline(
    cdp.send('Emulation.setDeviceMetricsOverride', {...viewport, mobile: false}),
    EVAL_MS,
    'Emulation.setDeviceMetricsOverride'
  )
  await waitFor(`the viewport to be ${viewport.width}x${viewport.height}@${viewport.deviceScaleFactor}x`, RESET_MS, async () =>
    withDeadline(
      page.evaluate(
        ([width, height, dpr]) => {
          const w = globalThis as unknown as PageWindow
          return w.innerWidth === width && w.innerHeight === height && w.devicePixelRatio === dpr
        },
        [viewport.width, viewport.height, viewport.deviceScaleFactor] as const
      ),
      EVAL_MS,
      'reading the viewport size'
    )
  )
}

// ---------------------------------------------------------------- other windows

const REMOTE_HTML = '/desktop/remote/remote.html'
// The tray widget's window options that change what it draws (desktop/app/menu-bar.desktop.tsx):
// it is transparent around the arrow at its top.
const MENUBAR_WINDOW_OPTS = {hasShadow: true, transparent: true}

// Date fixed in every remote window from its first script; the main window keeps its own script.
const remoteDateScript = (now: number) =>
  `if (location.pathname.endsWith(${JSON.stringify(REMOTE_HTML)})) (${fixDate.toString()})(${now})`

const preloadCall = async <K extends keyof PreloadFunctions>(page: Page, name: K, args: Parameters<PreloadFunctions[K]>) =>
  withDeadline(
    page.evaluate(
      ([n, a]) => {
        const f = (globalThis as unknown as DevGlobals)._fromPreload?.functions
        if (!f) throw new Error('the preload functions (_fromPreload) are not in the main window')
        return (f[n] as (...x: Array<unknown>) => unknown)(...a)
      },
      [name, args as Array<unknown>] as const
    ),
    EVAL_MS,
    `preload ${name}`
  ) as Promise<Awaited<ReturnType<PreloadFunctions[K]>>>

const dispatchRemote = async (page: Page, type: string, payload: object) => preloadCall(page, 'mainWindowDispatch', [{payload, type}])

const remoteWindowsOf = (ctx: BrowserContext, component: string, param: string) =>
  ctx.pages().filter(p => {
    if (p.isClosed()) return false
    const u = new URL(p.url(), 'http://x')
    return u.pathname.endsWith(REMOTE_HTML) && u.searchParams.get('component') === component && u.searchParams.get('param') === param
  })

type OpenWindow = {page: Page; close: () => Promise<void>}

// Opens an entry's window and returns its page once its props have rendered. In a dev build a
// proxy that makes its window from an effect makes it twice (strict mode closes the first at
// once), so the page is the one that renders.
const openWindow = async (ctx: BrowserContext, main: Page, w: RemoteWindow, theme: Theme): Promise<OpenWindow> => {
  const windowComponent = w.component
  const username = w.component === 'tracker' ? await resolveValue(w.username) : undefined
  if (username !== undefined && typeof username !== 'string') throw new Error('the tracker username is not a string')
  const windowParam = username ?? w.component
  const what = `the ${windowComponent} window${w.component === 'tracker' ? ` for ${windowParam}` : ''}`
  if (remoteWindowsOf(ctx, windowComponent, windowParam).length) {
    throw new Error(`${what} is already open; close it (or relaunch the app) and rerun`)
  }
  const windowOpts = {...w.size, ...(w.component === 'menubar' ? MENUBAR_WINDOW_OPTS : {})}
  const waitClosed = async () =>
    waitFor(`${what} to close`, RESET_MS, async () => Promise.resolve(remoteWindowsOf(ctx, windowComponent, windowParam).length === 0))
  let closeIt: () => Promise<void>
  switch (w.component) {
    case 'menubar': {
      // The tray's first show is what starts the widget loading its recent files.
      const shown = await withDeadline(
        main.evaluate(() => {
          const store = (globalThis as unknown as DevGlobals).__ZUSTAND_HMR__?.get('config') as ConfigStore | undefined
          if (!store) throw new Error('the config store is not in __ZUSTAND_HMR__; is this a dev build?')
          return store.getState().windowShownCount.get('menu') ?? 0
        }),
        EVAL_MS,
        'reading the menu window count'
      )
      if (!shown) await dispatchRemote(main, 'remote:updateWindowShown', {component: 'menu'})
      if (!(await preloadCall(main, 'getRemoteProps', [windowComponent, windowParam]))) {
        throw new Error('the main window has sent the menubar no props')
      }
      await preloadCall(main, 'makeRenderer', [{windowComponent, windowOpts, windowParam}])
      // Closing a window drops its cached props, and the proxy sends only on a change, so the
      // latest props go back in the cache for the next window.
      closeIt = async () => {
        const props = await preloadCall(main, 'getRemoteProps', [windowComponent, windowParam])
        await preloadCall(main, 'closeRenderer', [{windowComponent, windowParam}])
        await waitClosed()
        if (props) await preloadCall(main, 'rendererNewProps', [{propsStr: props, windowComponent, windowParam}])
      }
      break
    }
    case 'pinentry':
    case 'unlock-folders': {
      const props = await resolveValue(w.props)
      const propsStr = JSON.stringify({...(props as object), darkMode: theme === 'dark'})
      await preloadCall(main, 'rendererNewProps', [{propsStr, windowComponent, windowParam}])
      await preloadCall(main, 'makeRenderer', [{windowComponent, windowOpts, windowParam}])
      closeIt = async () => {
        await preloadCall(main, 'closeRenderer', [{windowComponent, windowParam}])
        await waitClosed()
      }
      break
    }
    case 'tracker': {
      const guiID = `visual-gate-${Date.now()}`
      const load = {assertion: windowParam, forceDisplay: true, fromDaemon: false, guiID, ignoreCache: false, inTracker: true, reason: w.reason}
      await dispatchRemote(main, 'remote:trackerLoad', load)
      closeIt = async () => {
        await dispatchRemote(main, 'remote:trackerCloseTracker', {guiID})
        await waitClosed()
      }
      break
    }
  }
  let page: Page | undefined
  try {
    await waitFor(`${what} to render`, READY_MS, async () => {
      for (const p of remoteWindowsOf(ctx, windowComponent, windowParam)) {
        const rendered = await p
          .evaluate(() => ((globalThis as unknown as {document: {getElementById: (id: string) => {childElementCount: number} | null}}).document.getElementById('root')?.childElementCount ?? 0) > 0)
          .catch(() => false)
        if (rendered) {
          page = p
          return true
        }
      }
      return false
    })
  } catch (e) {
    await closeIt().catch(() => {})
    throw e
  }
  return {close: closeIt, page: page!}
}

// The window's viewport, color scheme and Date, as the main window's.
const fixWindow = async (ctx: BrowserContext, page: Page, size: WindowSize, theme: Theme, frozenAt: number) => {
  // left attached: the override lasts while it is, and it goes with the window
  const cdp = await withDeadline(ctx.newCDPSession(page), CONNECT_MS, 'opening a CDP session to the window')
  await fixViewport(cdp, page, {...size, deviceScaleFactor: DEVICE_SCALE_FACTOR})
  await withDeadline(page.emulateMedia({colorScheme: theme}), EVAL_MS, 'emulating the window color scheme')
  const now = await withDeadline(page.evaluate(() => Date.now()), EVAL_MS, 'reading Date.now in the window')
  if (now !== frozenAt) throw new Error(`Date is not fixed in the window: Date.now() is ${now}, wanted ${frozenAt}`)
  await withDeadline(page.mouse.move(-1, -1), EVAL_MS, 'parking the mouse in the window')
}

// The app follows prefers-color-scheme while its preference is 'system'. Any other preference is
// switched to 'system' in the renderer's store only (never written to the service config); a
// reload reads the real preference back.
const applyTheme = async (page: Page, theme: Theme) => {
  await withDeadline(page.emulateMedia({colorScheme: theme}), EVAL_MS, 'emulating the color scheme')
  const isDark = async () =>
    withDeadline(
      page.evaluate(() => {
        const store = (globalThis as unknown as DevGlobals).__ZUSTAND_HMR__?.get('darkmode') as DarkStore | undefined
        if (!store) throw new Error('the darkmode store is not in __ZUSTAND_HMR__; is this a dev build?')
        if (store.getState().darkModePreference !== 'system') store.setState({darkModePreference: 'system'})
        return store.getState().isDarkMode()
      }),
      EVAL_MS,
      'reading the dark mode store'
    )
  await waitFor(`the app to be in ${theme} mode`, RESET_MS, async () => (await isDark()) === (theme === 'dark'))
}

// The Electron listening on this CDP port was launched with launch-app.mts --visual.
const checkVisualSwitches = (cdpPort: number) => {
  const lines = execFileSync('ps', ['-axww', '-o', 'args='], {encoding: 'utf8', timeout: 5_000}).split('\n')
  const app = lines.find(l => l.includes('Electron') && l.includes(`--remote-debugging-port=${cdpPort}`))
  if (!app) throw new Error(`no Electron process with --remote-debugging-port=${cdpPort}`)
  const missing = VISUAL_CAPTURE_ARGS.filter(a => !app.split(' ').includes(a))
  if (missing.length) {
    throw new Error(
      `the app was not launched for visual runs (missing ${missing.join(' ')}); relaunch with node tests/e2e/electron/launch-app.mts --visual`
    )
  }
}

export async function openDesktop(cdpPort = 9222): Promise<DesktopSession> {
  checkVisualSwitches(cdpPort)
  let browser: Browser
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, {timeout: CONNECT_MS})
  } catch {
    throw new Error(`no CDP answer on port ${cdpPort}; launch with node tests/e2e/electron/launch-app.mts`)
  }
  const page = findMainPage(browser)
  page.setDefaultTimeout(READY_MS)
  const ctx = page.context()
  const cdp = await withDeadline(ctx.newCDPSession(page), CONNECT_MS, 'opening a CDP session')
  // without it, scripts added with Page.addScriptToEvaluateOnNewDocument never run
  await withDeadline(cdp.send('Page.enable'), EVAL_MS, 'Page.enable')
  let theme: Theme | undefined
  let frozenAt: number | undefined
  let dateScript: string | undefined
  let remoteDate: {dispose: () => Promise<void>} | undefined

  const prepare: DesktopSession['prepare'] = async opts => {
    if (dateScript) await withDeadline(cdp.send('Page.removeScriptToEvaluateOnNewDocument', {identifier: dateScript}), EVAL_MS, 'removing the Date script')
    const added = await withDeadline(
      cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: `(${fixDate.toString()})(${opts.frozenAt})`}),
      EVAL_MS,
      'adding the Date script'
    )
    dateScript = added.identifier
    await remoteDate?.dispose()
    remoteDate = await withDeadline(ctx.addInitScript({content: remoteDateScript(opts.frozenAt)}), EVAL_MS, 'adding the window Date script')
    await withDeadline(page.evaluate(fixDate, opts.frozenAt), EVAL_MS, 'fixing Date')
    let chrome: Prepared['chrome'] = null
    if (opts.reload) {
      await checkRendererAfterReload(page)
      await waitForNoLoading(page)
      chrome = await coverageMounted(page)
    }
    const now = await withDeadline(page.evaluate(() => Date.now()), EVAL_MS, 'reading Date.now')
    if (now !== opts.frozenAt) throw new Error(`Date is not fixed in the page: Date.now() is ${now}, wanted ${opts.frozenAt}`)
    await fixViewport(cdp, page)
    await applyTheme(page, opts.theme)
    theme = opts.theme
    frozenAt = opts.frozenAt
    return {chrome}
  }

  const capture: DesktopSession['capture'] = async entry => {
    let png: Buffer | undefined
    let win: OpenWindow | undefined
    const fixture = fixtureCapture(fixtureHooks(page), entry.fixture)
    let result: Capture
    try {
      if (!theme || frozenAt === undefined) throw new Error('capture called before prepare')
      await fixture.assertNoneActive()
      // Another CDP client attaching (a second Playwright connection) resets the emulated color
      // scheme to its own default, so the emulation is reasserted for every capture.
      await fixViewport(cdp, page)
      await applyTheme(page, theme)
      // before the reset, so coverage includes what switching to the tab mounts; a window's
      // coverage is everything mounted in it, since it opens for this capture
      const seq = entry.window ? null : await coverageSeq(page)
      await resetTo(page, entry.nav.tab)
      // A setup click leaves the pointer where it clicked, and whatever lands under it later draws
      // hovered. Parked outside the viewport, nothing is hovered unless a hover step asks for it.
      await withDeadline(page.mouse.move(-1, -1), EVAL_MS, 'parking the mouse')
      if (entry.fixture) {
        // installed on an idle app, then every screen remounts so none keeps live data
        await waitForNoLoading(page)
        await fixture.begin()
        await remountScreens(page)
      }
      const nav = await resolveParams(entry.nav)
      const append = nav.append
      if (append) {
        const ok = await withDeadline(
          // as JSON: Playwright's serializable type check recurses without end on a JSON value type
          page.evaluate(
            json => (globalThis as unknown as DevGlobals).DEBUGRouter2?.navigateAppend(JSON.parse(json) as {name: string}) ?? false,
            JSON.stringify({name: append.name, params: append.params})
          ),
          EVAL_MS,
          `navigateAppend ${append.name}`
        )
        if (!ok) throw new Error(`navigateAppend ${append.name} did not navigate`)
      }
      const thread = nav.thread
      if (thread) {
        await withDeadline(
          page.evaluate(id => {
            const r = (globalThis as unknown as DevGlobals).DEBUGRouter2
            if (!r) throw new Error('DEBUGRouter2 is not defined; is this a dev build?')
            r.navigateToThread(id, 'misc')
          }, thread),
          EVAL_MS,
          'navigateToThread'
        )
      }
      let shown = page
      if (entry.window) {
        win = await openWindow(ctx, page, entry.window, theme)
        shown = win.page
        shown.setDefaultTimeout(READY_MS)
        await fixWindow(ctx, shown, entry.window.size, theme, frozenAt)
      }
      if (entry.setup?.length) {
        await waitForNoLoading(page, shown)
        for (const s of entry.setup) await runStep(shown, s)
      }
      await shown.getByTestId(entry.ready).locator('visible=true').first().waitFor({state: 'visible', timeout: READY_MS})
      await fixture.ready()
      await waitForNoLoading(page, shown)
      await waitForAssets(shown)
      await stillVideos(shown)
      const obtrusive = await withDeadline(
        shown.evaluate(() =>
          (globalThis as unknown as PageWindow).document.body.classList.contains('layout-scrollbar-obtrusive')
        ),
        EVAL_MS,
        'reading the scrollbar kind'
      )
      const style = obtrusive ? undefined : HIDE_OVERLAY_SCROLLBARS
      const settled = await settle(async () => {
        png = await shown.screenshot({animations: 'disabled', caret: 'hide', style, timeout: EVAL_MS})
        return png
      }, SETTLE)
      png = settled.png
      const dpr = await withDeadline(shown.evaluate(() => (globalThis as unknown as PageWindow).devicePixelRatio), EVAL_MS, 'devicePixelRatio')
      const masks = await maskRects(shown, entry, dpr)
      const coverage = win ? await coverageMounted(shown) : await coverageNowSince(page, seq)
      result = {coverage, masks, png, status: settled.stable ? 'ok' : 'unstable'}
    } catch (e) {
      result = {coverage: null, error: (e as Error).message, masks: [], png: png ?? Buffer.alloc(0), status: 'failed'}
    }
    const fail = (why: string) => {
      result = {...result, error: result.error ? `${result.error}; ${why}` : why, status: 'failed'}
    }
    if (win) {
      try {
        await win.close()
      } catch (e) {
        fail(`closing the window: ${(e as Error).message}`)
      }
    }
    const problems = await fixture.end()
    if (problems.length) fail(problems.join('; '))
    return result
  }

  // Hands the app back as it was: real Date (which takes a reload), its own dark mode preference,
  // its window size. Never closes the browser.
  const close: DesktopSession['close'] = async () => {
    await withDeadline(page.emulateMedia({colorScheme: null}), EVAL_MS, 'clearing the color scheme').catch(() => {})
    await withDeadline(remoteDate?.dispose() ?? Promise.resolve(), EVAL_MS, 'removing the window Date script').catch(() => {})
    remoteDate = undefined
    await withDeadline(cdp.send('Emulation.clearDeviceMetricsOverride'), EVAL_MS, 'clearing the viewport').catch(() => {})
    try {
      if (dateScript) {
        await withDeadline(cdp.send('Page.removeScriptToEvaluateOnNewDocument', {identifier: dateScript}), EVAL_MS, 'removing the Date script')
        dateScript = undefined
        await checkRendererAfterReload(page)
      }
    } finally {
      await withDeadline(cdp.detach(), EVAL_MS, 'detaching CDP').catch(() => {})
    }
  }

  const cleanupCommands = () => desktopCleanupCommands(SHARED_DIR)

  return {capture, cleanupCommands, close, prepare}
}
