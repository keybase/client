import * as Electron from 'electron'
import * as RemoteGen from '@/constants/remote-actions'
import * as R from '@/constants/remote'
import * as fs from 'fs'
import menuHelper from './menu-helper.desktop'
import {showDevTools} from '@/local-debug'
import {guiConfigFilename, isDarwin, isWindows, defaultUseNativeFrame} from '@/constants/platform'
import logger from '@/logger'
import debounce from 'lodash/debounce'
import {htmlURL, pageOrigin, preloadPath} from './html-root.desktop'
import KB2 from '@/util/electron'
import {getMainWindow, setMainWindow} from './main-window-ref.desktop'
import {isSamePage, localServerResponseHeaders, pageKey} from './bridge-rules.desktop'

const {env} = KB2.constants

const htmlFile = htmlURL('main')
const mainPage = pageKey(htmlFile)
const remotePage = pageKey(htmlURL('remote'))

// Fullscreen for any page. Notifications are shown by the main process, so pages get none. Match the
// requesting frame itself, not its top-level page, so a subframe can't borrow a window's grant.
const isPermissionGranted = (permission: string, isMainFrame: boolean, requestingUrl: string | undefined) => {
  switch (permission) {
    case 'fullscreen':
      return true
    // the app's pages load previews and avatars from the service's local http servers
    case 'local-network-access':
    case 'local-network':
    case 'loopback-network':
      return isMainFrame && (isSamePage(requestingUrl, mainPage) || isSamePage(requestingUrl, remotePage))
    default:
      return false
  }
}

const setupDefaultSession = () => {
  const ds = Electron.session.defaultSession

  // We are not using partitions on webviews, so this essentially disables
  // download for webviews. If we decide to start using partitions for
  // webviews, we should make sure to attach this to those partitions too.
  ds.on('will-download', event => event.preventDefault())

  ds.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    callback(isPermissionGranted(permission, details.isMainFrame, details.requestingUrl))
  })
  ds.setPermissionCheckHandler((_webContents, permission, _requestingOrigin, details) =>
    isPermissionGranted(permission, details.isMainFrame, details.requestingUrl)
  )
  ds.setDevicePermissionHandler(() => false)
  ds.setDisplayMediaRequestHandler((_request, callback) => callback(null))

  // A session keeps only its last onHeadersReceived listener, so every local server response that
  // needs a header goes through this one. Images and media never load as documents, so they skip it.
  const localServerFilter: Electron.WebRequestFilter = {
    types: ['mainFrame', 'subFrame', 'object', 'xhr'],
    urls: ['http://127.0.0.1:*/*'],
  }
  ds.webRequest.onHeadersReceived(localServerFilter, (details, callback) => {
    callback({responseHeaders: localServerResponseHeaders(details.url, details.responseHeaders, pageOrigin)})
  })
}

const defaultWindowState = {
  dockHidden: false,
  height: 600,
  isFullScreen: false,
  width: 810,
  windowHidden: false,
  x: 0,
  y: 0,
}

const windowState = {...defaultWindowState}

// The visual gate (tests/e2e/visual) captures an emulated viewport of this size; a content area that
// matches it shows whoever watches a run what is captured. The size is not saved as window state.
const visualContentSize = (() => {
  const m = /^(\d+)x(\d+)$/.exec(Electron.app.commandLine.getSwitchValue('kb-visual-content-size'))
  return m ? {height: Number(m[2]), width: Number(m[1])} : undefined
})()

const setupWindowEvents = (win: Electron.BrowserWindow) => {
  const saveWindowState = debounce(() => {
    const winBounds = win.getNormalBounds()
    windowState.x = winBounds.x
    windowState.y = winBounds.y
    windowState.width = winBounds.width
    windowState.height = winBounds.height
    windowState.isFullScreen = win.isFullScreen()
    windowState.windowHidden = !win.isVisible()
    R.remoteDispatch(RemoteGen.createUpdateWindowState({windowState}))
  }, 5000)

  if (!visualContentSize) {
    win.on('show', saveWindowState)
    win.on('close', saveWindowState)
    win.on('resize', saveWindowState)
    win.on('move', saveWindowState)
  }

  const hideInsteadOfClose = (event: Electron.Event) => {
    event.preventDefault()
    win.hide()
    hideDockIcon()
  }

  win.on('close', hideInsteadOfClose)
}

const changeDock = (show: boolean) => {
  const dock = Electron.app.dock
  if (!dock) return
  windowState.dockHidden = !show
  R.remoteDispatch(RemoteGen.createUpdateWindowState({windowState}))
  if (show) {
    dock
      .show()
      .then(() => {})
      .catch(() => {})
  } else {
    dock.hide()
  }
}

export const showDockIcon = () => changeDock(true)
export const hideDockIcon = () => changeDock(false)

let useNativeFrame = defaultUseNativeFrame
let disableSpellCheck = false
let disableScreenshot = false

export const isScreenshotDisabled = () => disableScreenshot

const themeBackgroundColor = () => (Electron.nativeTheme.shouldUseDarkColors ? '#191919' : '#ffffff')

// Without the native frame, Windows and Linux draw their own window controls over the top of the page
// (right, left or both, by the OS button layout), at the height of the header's top row. The overlay is
// see-through so the header's own color shows under the controls; it keeps the theme background's RGB
// because Linux blends the button hover against the overlay color with its alpha dropped. Spelled as
// rgba() since Electron reads 8-digit hex as #AARRGGBB. The symbols use the header's black_50_on_white.
let windowControlsOverlay = false
const transparentThemeBackground = () => {
  const hex = themeBackgroundColor()
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, 0)`
}
const titleBarOverlay = () => ({
  color: transparentThemeBackground(),
  height: 40,
  symbolColor: Electron.nativeTheme.shouldUseDarkColors ? '#808080' : '#7f7f7f',
})

// only the main window uses themeBackgroundColor; the others (menubar, tracker) are transparent
export const registerThemeBackgrounds = () => {
  Electron.nativeTheme.on('updated', () => {
    const win = getMainWindow()
    win?.setBackgroundColor(themeBackgroundColor())
    if (windowControlsOverlay) {
      win?.setTitleBarOverlay(titleBarOverlay())
    }
  })
}

/**
 * loads data that we normally save from configGuiSetValue. At this point the service might not exist so we must read it directly
 * node never writes to it, only the renderer does
 */
const loadWindowState = () => {
  let openAtLogin = true
  try {
    let s: string = ''
    try {
      s = fs.readFileSync(guiConfigFilename, {encoding: 'utf8'})
    } catch {}
    const guiConfig = JSON.parse(s) as
      | Partial<{
          openAtLogin: unknown
          useNativeFrame: unknown
          ui: Partial<{
            disableSpellCheck: unknown
            disableScreenshot: unknown
            darkMode: unknown
          }>
          windowState: unknown
        }>
      | undefined

    openAtLogin = typeof guiConfig?.openAtLogin === 'boolean' ? guiConfig.openAtLogin : openAtLogin
    useNativeFrame =
      typeof guiConfig?.useNativeFrame === 'boolean' ? guiConfig.useNativeFrame : useNativeFrame

    if (guiConfig?.ui) {
      const {
        darkMode: _darkMode,
        disableSpellCheck: _disableSpellCheck,
        disableScreenshot: _disableScreenshot,
      } = guiConfig.ui
      disableSpellCheck = typeof _disableSpellCheck === 'boolean' ? _disableSpellCheck : disableSpellCheck
      disableScreenshot = typeof _disableScreenshot === 'boolean' ? _disableScreenshot : disableScreenshot

      // nativeTheme.shouldUseDarkColors then answers for every window, falling back to the OS when unset
      switch (_darkMode) {
        case 'system':
          Electron.nativeTheme.themeSource = 'system'
          break
        case 'alwaysDark':
          Electron.nativeTheme.themeSource = 'dark'
          break
        case 'alwaysLight':
          Electron.nativeTheme.themeSource = 'light'
          break
        default:
      }
    }

    const obj = JSON.parse(typeof guiConfig?.windowState === 'string' ? guiConfig.windowState : '') as
      | undefined
      | Partial<{
          dockHidden: unknown
          height: unknown
          isFullScreen: unknown
          width: unknown
          windowHidden: unknown
          x: unknown
          y: unknown
        }>
    windowState.dockHidden = typeof obj?.dockHidden === 'boolean' ? obj.dockHidden : windowState.dockHidden
    windowState.height = typeof obj?.height === 'number' ? obj.height : windowState.height
    windowState.isFullScreen =
      typeof obj?.isFullScreen === 'boolean' ? obj.isFullScreen : windowState.isFullScreen
    windowState.width = typeof obj?.width === 'number' ? obj.width : windowState.width
    windowState.windowHidden =
      typeof obj?.windowHidden === 'boolean' ? obj.windowHidden : windowState.windowHidden
    windowState.x = typeof obj?.x === 'number' ? obj.x : windowState.x
    windowState.y = typeof obj?.y === 'number' ? obj.y : windowState.y

    // sanity check it fits in the screen
    const displayBounds = Electron.screen.getDisplayMatching({
      height: windowState.height,
      width: windowState.width,
      x: windowState.x,
      y: windowState.y,
    }).bounds

    if (
      windowState.x > displayBounds.x + displayBounds.width ||
      windowState.x + windowState.width < displayBounds.x ||
      windowState.y > displayBounds.y + displayBounds.height ||
      windowState.y + windowState.height < displayBounds.y
    ) {
      windowState.height = defaultWindowState.height
      windowState.width = defaultWindowState.width
      windowState.x = defaultWindowState.x
      windowState.y = defaultWindowState.y
    }
  } catch {
    logger.info(`Couldn't load`, guiConfigFilename, ' continuing...')
  }

  if ((isDarwin || isWindows) && Electron.app.getLoginItemSettings().openAtLogin !== openAtLogin) {
    logger.info('Setting login item state', openAtLogin)
    if (__DEV__) {
      logger.info('Setting login item state skipped due to dev')
    } else {
      Electron.app.setLoginItemSettings({openAtLogin})
    }
  }
}

const fixWindowsScalingIssue = (win: Electron.BrowserWindow) => {
  if (!isWindows) {
    return
  }
  // DPI scaling issues
  // https://github.com/electron/electron/issues/10862
  win.setBounds({
    height: windowState.height,
    width: windowState.width,
    x: windowState.x,
    y: windowState.y,
  })
}

const maybeShowWindowOrDock = (win: Electron.BrowserWindow) => {
  const openedAtLogin = Electron.app.getLoginItemSettings().wasOpenedAtLogin
  // electron 44 removed restoreState/wasOpenedAsHidden with no replacement, so any login launch
  // counts as a restore and we fall back to the window/dock hidden state we persist ourselves
  const isRestore = !!env.KEYBASE_RESTORE_UI || isWindows || openedAtLogin
  const hideWindowOnStart = env.KEYBASE_AUTOSTART === '1'
  logger.info('KEYBASE_AUTOSTART =', env.KEYBASE_AUTOSTART)
  logger.info('KEYBASE_START_UI =', env.KEYBASE_START_UI)
  logger.info('Opened at login:', openedAtLogin)
  logger.info('Is restore:', isRestore)

  // Don't show main window:
  // - If we hide window on start,
  // - or, if we are restoring and window was hidden
  const hideMainWindow = hideWindowOnStart || (isRestore && windowState.windowHidden)

  logger.info('Hide main window:', hideMainWindow)
  if (!hideMainWindow) {
    // On Windows we can try showing before Windows is ready
    // This will result in a dropped .show request
    // We add a listener to `did-finish-load` so we can show it when
    // Windows is ready.
    showDockIcon()

    win.show()
    win.webContents.once('did-finish-load', () => {
      win.show()
    })
  }

  // Don't show dock:
  // - If we are restoring and dock was hidden
  const shouldHideDockIcon = isRestore && windowState.dockHidden
  logger.info('Hide dock icon:', shouldHideDockIcon)
  if (shouldHideDockIcon) {
    hideDockIcon()
  }
}

const registerForAppLinks = () => {
  // Register for SEP7 and Keybase links.
  Electron.app.setAsDefaultProtocolClient('web+stellar')
  Electron.app.setAsDefaultProtocolClient('keybase')
}

export const closeWindows = () => {
  const windows = Electron.BrowserWindow.getAllWindows()
  windows.forEach(w => {
    // We tell it to close, we can register handlers for the 'close' event if we want to
    // keep this window alive or hide it instead.
    w.close()
  })
  hideDockIcon()
}

const MainWindow = () => {
  setupDefaultSession()
  loadWindowState()

  windowControlsOverlay = !isDarwin && !useNativeFrame
  const win = new Electron.BrowserWindow({
    backgroundColor: themeBackgroundColor(),
    ...(windowControlsOverlay
      ? {titleBarOverlay: titleBarOverlay(), titleBarStyle: 'hidden' as const}
      : {frame: useNativeFrame}),
    height: visualContentSize?.height ?? windowState.height,
    minHeight: 600,
    minWidth: 740,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      devTools: showDevTools,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      preload: preloadPath,
      sandbox: true,
      spellcheck: !disableSpellCheck,
    },
    useContentSize: !!visualContentSize,
    width: visualContentSize?.width ?? windowState.width,
    x: windowState.x,
    y: windowState.y,
    ...(isDarwin ? {titleBarStyle: 'hiddenInset'} : {}),
  })

  // before the page loads: the IPC sender checks and the subframe guard recognize the main window by this
  setMainWindow(win)
  win.setContentProtection(disableScreenshot)

  win
    .loadURL(htmlFile)
    .then(() => {})
    .catch(() => {})
  if (!disableSpellCheck) {
    win.webContents.session.setSpellCheckerDictionaryDownloadURL(
      'https://keybase.io/dictionaries/hunspell_dictionaries.zip/'
    )
  }

  if (windowState.isFullScreen && !visualContentSize) {
    win.setFullScreen(true)
  }

  menuHelper(win)

  if (showDevTools && !process.env['KB_E2E_TEST']) {
    win.webContents.openDevTools({mode: 'detach', title: `${__DEV__ ? 'DEV' : 'Prod'} Keybase Devtools`})
  }

  registerForAppLinks()
  fixWindowsScalingIssue(win)
  maybeShowWindowOrDock(win)

  setupWindowEvents(win)
}

export default MainWindow
