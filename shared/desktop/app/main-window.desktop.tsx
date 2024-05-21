import URL from 'url-parse'
import * as Electron from 'electron'
import * as RemoteGen from '@/actions/remote-gen'
import * as R from '@/constants/remote'
import * as fs from 'fs'
import menuHelper from './menu-helper.desktop'
import {showDevTools} from '@/local-debug'
import {guiConfigFilename, isDarwin, isWindows, defaultUseNativeFrame} from '@/constants/platform.desktop'
import logger from '@/logger'
import debounce from 'lodash/debounce'
import {setupDevToolsExtensions} from './dev-tools.desktop'
import {assetRoot, htmlPrefix} from './html-root.desktop'
import KB2 from '@/util/electron.desktop'

const {env} = KB2.constants

let htmlFile = `${htmlPrefix}${assetRoot}main${__FILE_SUFFIX__}.html`

const setupDefaultSession = () => {
  const ds = Electron.session.defaultSession

  // We are not using partitions on webviews, so this essentially disables
  // download for webviews. If we decide to start using partitions for
  // webviews, we should make sure to attach this to those partitions too.
  ds.on('will-download', event => event.preventDefault())

  // Disallow any permissions requests except for notifications and fullscreen
  ds.setPermissionRequestHandler((webContents, permission, callback) => {
    // allow fullscreen
    if (permission === 'fullscreen') {
      return callback(true)
    }
    const ourURL = new URL(htmlFile)
    const requestURL = new URL(webContents.getURL())
    if (
      permission === 'notifications' &&
      requestURL.pathname.toLowerCase() === ourURL.pathname.toLowerCase()
    ) {
      // Allow notifications
      return callback(true)
    }
    return callback(false)
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

  win.on('show', saveWindowState)
  win.on('close', saveWindowState)
  win.on('resize', saveWindowState)
  win.on('move', saveWindowState)

  const hideInsteadOfClose = (event: Electron.Event) => {
    event.preventDefault()
    win.hide()
    hideDockIcon()
  }

  win.on('close', hideInsteadOfClose)

  if (!isDarwin) {
    const emitMaxChange = () => {
      R.remoteDispatch(RemoteGen.createUpdateWindowMaxState({max: win.isMaximized()}))
    }

    win.on('maximize', emitMaxChange)
    win.on('unmaximize', emitMaxChange)
  }
}

const changeDock = (show: boolean) => {
  const _dock = Electron.app.dock
  const dock = _dock as typeof _dock | undefined
  if (!dock) return
  if (show) {
    dock
      .show()
      .then(() => {})
      .catch(() => {})
  } else {
    dock.hide()
  }

  windowState.dockHidden = !show
  R.remoteDispatch(RemoteGen.createUpdateWindowState({windowState}))
}

export const showDockIcon = () => changeDock(true)
export const hideDockIcon = () => changeDock(false)

let useNativeFrame = defaultUseNativeFrame
let isDarkMode = false
let darkModePreference: undefined | 'system' | 'alwaysDark' | 'alwaysLight'
let disableSpellCheck = false

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
            darkMode: unknown
          }>
          windowState: unknown
        }>
      | undefined

    openAtLogin = typeof guiConfig?.openAtLogin === 'boolean' ? guiConfig.openAtLogin : openAtLogin
    useNativeFrame =
      typeof guiConfig?.useNativeFrame === 'boolean' ? guiConfig.useNativeFrame : useNativeFrame

    if (guiConfig?.ui) {
      const {darkMode, disableSpellCheck: _disableSpellCheck} = guiConfig.ui
      disableSpellCheck = typeof _disableSpellCheck === 'boolean' ? _disableSpellCheck : disableSpellCheck

      if (typeof darkMode === 'string') {
        switch (darkMode) {
          case 'system':
            darkModePreference = darkMode
            isDarkMode = KB2.constants.startDarkMode
            break
          case 'alwaysDark':
            darkModePreference = darkMode
            isDarkMode = true
            break
          case 'alwaysLight':
            darkModePreference = darkMode
            isDarkMode = false
            break
        }
      }
    } else {
      darkModePreference = 'system'
      isDarkMode = KB2.constants.startDarkMode
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
  // app.getLoginItemSettings().restoreState is Mac only, so consider it always on in Windows
  const isRestore = !!env.KEYBASE_RESTORE_UI || Electron.app.getLoginItemSettings().restoreState || isWindows
  const hideWindowOnStart = env.KEYBASE_AUTOSTART === '1'
  const openHidden = Electron.app.getLoginItemSettings().wasOpenedAsHidden
  logger.info('KEYBASE_AUTOSTART =', env.KEYBASE_AUTOSTART)
  logger.info('KEYBASE_START_UI =', env.KEYBASE_START_UI)
  logger.info('Opened at login:', openedAtLogin)
  logger.info('Is restore:', isRestore)
  logger.info('Open hidden:', openHidden)

  // Don't show main window:
  // - If we are set to open hidden,
  // - or, if we hide window on start,
  // - or, if we are restoring and window was hidden
  // - or, if we were opened from login (but not restoring)
  const hideMainWindow =
    openHidden ||
    hideWindowOnStart ||
    (isRestore && windowState.windowHidden) ||
    (openedAtLogin && !isRestore)

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
  // - If we are set to open hidden,
  // - or, if we are restoring and dock was hidden
  // - or, if we were opened from login (but not restoring)
  const shouldHideDockIcon =
    openHidden || (isRestore && windowState.dockHidden) || (openedAtLogin && !isRestore)
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

  // pass to main window
  htmlFile = htmlFile + `?darkModePreference=${darkModePreference || ''}`
  const win = new Electron.BrowserWindow({
    backgroundColor: isDarkMode ? '#191919' : '#ffffff',
    frame: useNativeFrame,
    height: windowState.height,
    minHeight: 600,
    minWidth: 740,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      devTools: showDevTools,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      preload: `${assetRoot}preload${__FILE_SUFFIX__}.bundle.js`,
      spellcheck: !disableSpellCheck,
    },
    width: windowState.width,
    x: windowState.x,
    y: windowState.y,
    ...(isDarwin ? {titleBarStyle: 'hiddenInset'} : {}),
  })
  if (__DEV__ || __PROFILE__) {
    setupDevToolsExtensions()
  }

  win
    .loadURL(htmlFile)
    .then(() => {})
    .catch(() => {})
  if (!disableSpellCheck) {
    win.webContents.session.setSpellCheckerDictionaryDownloadURL(
      'https://keybase.io/dictionaries/hunspell_dictionaries.zip/'
    )
  }

  if (windowState.isFullScreen) {
    win.setFullScreen(true)
  }

  menuHelper(win)

  if (showDevTools) {
    win.webContents.openDevTools({mode: 'detach', title: `${__DEV__ ? 'DEV' : 'Prod'} Keybase Devtools`})
  }

  registerForAppLinks()
  fixWindowsScalingIssue(win)
  maybeShowWindowOrDock(win)

  setupWindowEvents(win)
  return win
}

export const getMainWindow = (): Electron.BrowserWindow | undefined => {
  const w = Electron.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/main.'))
  return w
}
export default MainWindow
