// The app's windows besides the main one (desktop/remote), opened through the main window's
// preload functions and remote actions, the way the app opens them. Used by flows and by the visual
// driver (visual/driver-desktop.mts), so it runs under plain node too: relative imports with
// extensions, no path aliases.
import type {BrowserContext, Page} from '@playwright/test'
import {withDeadline} from '../../shared/deadline.ts'

export type RemoteWindowName = 'menubar' | 'tracker' | 'pinentry' | 'unlock-folders'
export type RemoteWindowSize = {width: number; height: number}

export const REMOTE_HTML = '/desktop/remote/remote.html'

const EVAL_MS = 5_000
const RESET_MS = 5_000
const READY_MS = 10_000
const POLL_MS = 100

// The sizes the app opens each window at.
const DEFAULT_SIZES: {readonly [K in RemoteWindowName]: RemoteWindowSize} = {
  menubar: {height: 640, width: 360},
  pinentry: {height: 230, width: 440},
  tracker: {height: 470, width: 320},
  'unlock-folders': {height: 300, width: 500},
}
// The tray widget's window options that change what it draws (desktop/app/menu-bar.desktop.tsx):
// it is transparent around the arrow at its top.
const MENUBAR_WINDOW_OPTS = {hasShadow: true, transparent: true}

// The preload's functions (desktop/renderer/preload.desktop.tsx) called in the main window.
type PreloadFunctions = {
  closeRenderer: (o: {windowComponent: string; windowParam: string}) => void
  getRemoteProps: (windowComponent: string, windowParam: string) => Promise<string>
  mainWindowDispatch: (action: {type: string; payload: object}) => void
  makeRenderer: (o: {windowComponent: string; windowOpts: object; windowParam: string}) => void
  rendererNewProps: (o: {propsStr: string; windowComponent: string; windowParam: string}) => void
}
type DevGlobals = {
  __ZUSTAND_HMR__?: Map<string, unknown>
  _fromPreload?: {functions: PreloadFunctions}
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (what: string, ms: number, check: () => Promise<boolean>) => {
  const start = Date.now()
  for (;;) {
    if (await check()) return
    if (Date.now() - start > ms) throw new Error(`timed out after ${ms / 1000}s waiting for ${what}`)
    await sleep(POLL_MS)
  }
}

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

// Sends an action to the main process's remote-window handlers as the main window does.
export const dispatchRemote = async (main: Page, type: string, payload: object) => preloadCall(main, 'mainWindowDispatch', [{payload, type}])

const remoteWindowsOf = (ctx: BrowserContext, component: string, param: string) =>
  ctx.pages().filter(p => {
    if (p.isClosed()) return false
    const u = new URL(p.url(), 'http://x')
    return u.pathname.endsWith(REMOTE_HTML) && u.searchParams.get('component') === component && u.searchParams.get('param') === param
  })

// The props the main window cached for a remote window, read the way the window's own component
// reads them: a window may only read the props cached for itself (getRemoteProps in
// desktop/app/ipc-handlers.desktop.tsx), so the main window cannot. '' when none of its pages has any.
const cachedWindowProps = async (ctx: BrowserContext, component: string, param: string) => {
  for (const p of remoteWindowsOf(ctx, component, param)) {
    const props = await withDeadline(
      p.evaluate(
        async ([c, pa]) => {
          const f = (globalThis as unknown as DevGlobals)._fromPreload?.functions
          return f ? f.getRemoteProps(c, pa) : ''
        },
        [component, param] as const
      ),
      EVAL_MS,
      `reading the ${component} window's props`
    ).catch(() => '')
    if (props) return props
  }
  return ''
}

// How to close each window openRemoteWindow returned.
const closers = new WeakMap<Page, () => Promise<void>>()

// Opens a remote window and returns its page once its props have rendered. `props`: for pinentry
// and unlock-folders the window's props (darkMode among them), for tracker {username, reason}; the
// menubar takes none. In a dev build a proxy that makes its window from an effect makes it twice
// (strict mode closes the first at once), so the page is the one that renders. Close it with
// closeRemoteWindow.
export const openRemoteWindow = async (
  context: BrowserContext,
  main: Page,
  name: RemoteWindowName,
  props?: object,
  opts?: {size?: RemoteWindowSize}
): Promise<Page> => {
  const windowComponent = name
  let windowParam: string = name
  if (name === 'tracker') {
    const username = (props as {username?: unknown} | undefined)?.username
    if (typeof username !== 'string' || !username) throw new Error('the tracker window needs props {username, reason}')
    windowParam = username
  }
  const what = `the ${windowComponent} window${name === 'tracker' ? ` for ${windowParam}` : ''}`
  if (remoteWindowsOf(context, windowComponent, windowParam).length) {
    throw new Error(`${what} is already open; close it (or relaunch the app) and rerun`)
  }
  const windowOpts = {...(opts?.size ?? DEFAULT_SIZES[name]), ...(name === 'menubar' ? MENUBAR_WINDOW_OPTS : {})}
  const waitClosed = async () =>
    waitFor(`${what} to close`, RESET_MS, async () => Promise.resolve(remoteWindowsOf(context, windowComponent, windowParam).length === 0))
  let closeIt: () => Promise<void>
  switch (name) {
    case 'menubar': {
      // Each show of the tray's window counts a 'menu' show in the main window
      // (desktop/app/menu-bar.desktop.tsx); the window made here counts as 'menubar' instead.
      await dispatchRemote(main, 'remote:updateWindowShown', {component: 'menu'})
      await preloadCall(main, 'makeRenderer', [{windowComponent, windowOpts, windowParam}])
      // Closing a window drops its cached props, and the proxy sends only on a change, so the
      // latest props go back in the cache for the next window.
      closeIt = async () => {
        const cached = await cachedWindowProps(context, windowComponent, windowParam)
        await preloadCall(main, 'closeRenderer', [{windowComponent, windowParam}])
        await waitClosed()
        if (cached) await preloadCall(main, 'rendererNewProps', [{propsStr: cached, windowComponent, windowParam}])
      }
      break
    }
    case 'pinentry':
    case 'unlock-folders': {
      await preloadCall(main, 'rendererNewProps', [{propsStr: JSON.stringify(props ?? {}), windowComponent, windowParam}])
      await preloadCall(main, 'makeRenderer', [{windowComponent, windowOpts, windowParam}])
      closeIt = async () => {
        await preloadCall(main, 'closeRenderer', [{windowComponent, windowParam}])
        await waitClosed()
      }
      break
    }
    case 'tracker': {
      const guiID = `e2e-tracker-${Date.now()}`
      const reason = (props as {reason?: unknown}).reason
      const load = {assertion: windowParam, forceDisplay: true, fromDaemon: false, guiID, ignoreCache: false, inTracker: true, reason: typeof reason === 'string' ? reason : ''}
      await dispatchRemote(main, 'remote:trackerLoad', load)
      // a follow or unfollow reloads the window under a new guiID, which its props carry
      closeIt = async () => {
        const cached = await cachedWindowProps(context, windowComponent, windowParam)
        const current = cached ? (JSON.parse(cached) as {guiID?: unknown}).guiID : undefined
        await dispatchRemote(main, 'remote:trackerCloseTracker', {guiID: typeof current === 'string' && current ? current : guiID})
        await waitClosed()
      }
      break
    }
  }
  let page: Page
  try {
    page = await waitRendered(context, windowComponent, windowParam, `${what} to render`)
  } catch (e) {
    const noProps = name === 'menubar' && !(await cachedWindowProps(context, windowComponent, windowParam))
    await closeIt().catch(() => {})
    throw noProps ? new Error('the main window has sent the menubar no props', {cause: e}) : e
  }
  closers.set(page, closeIt)
  return page
}

// The first of the component's windows whose root has rendered something, once one has.
const waitRendered = async (context: BrowserContext, windowComponent: string, windowParam: string, what: string) => {
  let page: Page | undefined
  await waitFor(what, READY_MS, async () => {
    for (const p of remoteWindowsOf(context, windowComponent, windowParam)) {
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
  if (!page) throw new Error(`${what}: no window rendered`)
  return page
}

type UnlockFoldersStore = {getState: () => {dispatch: {open: (devices: ReadonlyArray<object>) => void; close: () => void}}}
export type UnlockFoldersDevice = {deviceID: string; name: string; type: 'desktop' | 'mobile' | 'backup'}

const unlockFoldersDispatch = async (main: Page, call: 'open' | 'close', devices: ReadonlyArray<UnlockFoldersDevice> = []) =>
  withDeadline(
    main.evaluate(
      ([c, d]) => {
        const store = (globalThis as unknown as DevGlobals).__ZUSTAND_HMR__?.get('unlock-folders') as UnlockFoldersStore | undefined
        if (!store) throw new Error('the unlock-folders store is not in __ZUSTAND_HMR__; is this a dev build?')
        if (c === 'open') store.getState().dispatch.open(d)
        else store.getState().dispatch.close()
      },
      [call, devices] as const
    ),
    EVAL_MS,
    `unlock-folders ${call}`
  )

// Opens unlock-folders the way the service's rekeyUI.refresh does: the main window's store takes the
// devices and its proxy makes the window and sends its props. Unlike openRemoteWindow's, this window
// follows the app: it shows the service's paper key error and closes on an accepted paper key or
// its close button. Returns its page once rendered.
export const openUnlockFoldersAsRekey = async (context: BrowserContext, main: Page, devices: ReadonlyArray<UnlockFoldersDevice>) => {
  if (remoteWindowsOf(context, 'unlock-folders', 'unlock-folders').length) {
    throw new Error('the unlock-folders window is already open; close it (or relaunch the app) and rerun')
  }
  await unlockFoldersDispatch(main, 'open', devices)
  return waitRendered(context, 'unlock-folders', 'unlock-folders', 'the unlock-folders window to render')
}

export const unlockFoldersOpen = (context: BrowserContext) => remoteWindowsOf(context, 'unlock-folders', 'unlock-folders').length > 0

// Empties the store, as an accepted paper key does, which closes the window; then waits for it.
export const closeUnlockFoldersAsApp = async (context: BrowserContext, main: Page) => {
  await unlockFoldersDispatch(main, 'close')
  await waitFor('the unlock-folders window to close', RESET_MS, async () => Promise.resolve(!unlockFoldersOpen(context)))
}

// Closes a window openRemoteWindow opened, the way the app closes it.
export const closeRemoteWindow = async (page: Page) => {
  const closeIt = closers.get(page)
  if (!closeIt) throw new Error('closeRemoteWindow: not a window openRemoteWindow opened')
  closers.delete(page)
  await closeIt()
}

// Waits until the props the main window cached for a tracker window carry `guiID`: they are sent
// at most once a second, so after a reload they can still carry the one before, and the window's
// close goes by the cached guiID.
export const waitTrackerPropsGuiID = async (tracker: Page, guiID: string) => {
  const param = new URL(tracker.url(), 'http://x').searchParams.get('param') ?? ''
  let last = ''
  await waitFor(`the tracker window's props to carry guiID ${guiID}`, READY_MS, async () => {
    const cached = await cachedWindowProps(tracker.context(), 'tracker', param)
    last = cached ? String((JSON.parse(cached) as {guiID?: unknown}).guiID) : ''
    return last === guiID
  }).catch((e: unknown) => {
    throw new Error(`the tracker window's props carry guiID ${last || 'none'}, not ${guiID}`, {cause: e})
  })
}

// Closes every tracker window. Only for right after the main window reloaded: its trackers' state
// is gone then, so any tracker window still open is an orphan nothing else would close.
export const closeOrphanTrackerWindows = async (context: BrowserContext, main: Page) => {
  for (const p of context.pages()) {
    if (p.isClosed()) continue
    const u = new URL(p.url(), 'http://x')
    if (!u.pathname.endsWith(REMOTE_HTML) || u.searchParams.get('component') !== 'tracker') continue
    const windowParam = u.searchParams.get('param') ?? ''
    await preloadCall(main, 'closeRenderer', [{windowComponent: 'tracker', windowParam}])
    await waitFor(`the orphaned tracker window for ${windowParam} to close`, RESET_MS, async () =>
      Promise.resolve(remoteWindowsOf(context, 'tracker', windowParam).length === 0)
    )
  }
}
