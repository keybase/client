import URL from 'url-parse'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Electron from 'electron'
import * as ConfigGen from '../../actions/config-gen'
import * as fs from 'fs'
import menuHelper from './menu-helper.desktop'
import {mainWindowDispatch} from '../remote/util.desktop'
import {WindowState} from '../../constants/types/config'
import {showDevTools} from '../../local-debug.desktop'
import {guiConfigFilename, isDarwin, isWindows, defaultUseNativeFrame} from '../../constants/platform.desktop'
import logger from '../../logger'
import {resolveRootAsURL} from './resolve-root.desktop'
import debounce from 'lodash/debounce'

let htmlFile = resolveRootAsURL('dist', `main${__DEV__ ? '.dev' : ''}.html`)

const setupDefaultSession = () => {
  const ds = Electron.session.defaultSession
  if (!ds) {
    throw new Error('No default Session? Should be impossible')
  }
  // We are not using partitions on webviews, so this essentially disables
  // download for webviews. If we decide to start using partitions for
  // webviews, we should make sure to attach this to those partitions too.
  ds.on('will-download', event => event.preventDefault())
  // Disallow any permissions requests except for notifications
  ds.setPermissionRequestHandler((webContents, permission, callback) => {
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

const defaultWindowState: WindowState = {
  dockHidden: false,
  height: 600,
  isFullScreen: false,
  width: 800,
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
    mainWindowDispatch(ConfigGen.createUpdateWindowState({windowState}))
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

  type IPCPayload = {type: 'showMainWindow'} | {type: 'closeWindows'}
  Electron.app.on('KBkeybase' as any, (_: string, payload: IPCPayload) => {
    switch (payload.type) {
      case 'showMainWindow':
        win.show()
        showDockIcon()
        break
      case 'closeWindows':
        hideDockIcon()
        break
    }
  })
}

const changeDock = (show: boolean) => {
  const dock = Electron.app.dock
  if (!dock) return

  if (show) {
    dock.show()
  } else {
    dock.hide()
  }

  windowState.dockHidden = !show
  mainWindowDispatch(ConfigGen.createUpdateWindowState({windowState}))
}

export const showDockIcon = () => changeDock(true)
export const hideDockIcon = () => changeDock(false)

let useNativeFrame = defaultUseNativeFrame
let isDarkMode = false
let darkModePreference = undefined

/**
 * loads data that we normally save from configGuiSetValue. At this point the service might not exist so we must read it directly
 * node never writes to it, only the renderer does
 */
const loadWindowState = () => {
  let openAtLogin = true
  try {
    const s = fs.readFileSync(guiConfigFilename, {encoding: 'utf8'})
    const guiConfig = JSON.parse(s)

    if (guiConfig.openAtLogin !== undefined) {
      openAtLogin = guiConfig.openAtLogin
    }

    if (guiConfig.useNativeFrame !== undefined) {
      useNativeFrame = guiConfig.useNativeFrame
    }

    if (guiConfig.ui) {
      const {darkMode} = guiConfig.ui
      switch (darkMode) {
        case 'system':
          darkModePreference = darkMode
          isDarkMode = SafeElectron.workingIsDarkMode()
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

    const obj = JSON.parse(guiConfig.windowState)
    windowState.dockHidden = obj.dockHidden || windowState.dockHidden
    windowState.height = obj.height || windowState.height
    windowState.isFullScreen = obj.isFullScreen || windowState.isFullScreen
    windowState.width = obj.width || windowState.width
    windowState.windowHidden = obj.windowHidden || windowState.windowHidden
    windowState.x = obj.x === undefined ? windowState.x : obj.x
    windowState.y = obj.y === undefined ? windowState.y : obj.y

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
  } catch (e) {
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
  const isRestore =
    !!process.env['KEYBASE_RESTORE_UI'] || Electron.app.getLoginItemSettings().restoreState || isWindows
  const hideWindowOnStart = process.env['KEYBASE_AUTOSTART'] === '1'
  const openHidden = Electron.app.getLoginItemSettings().wasOpenedAsHidden
  logger.info('KEYBASE_AUTOSTART =', process.env['KEYBASE_AUTOSTART'])
  logger.info('KEYBASE_START_UI =', process.env['KEYBASE_START_UI'])
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

export default () => {
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
      devTools: showDevTools,
      nodeIntegration: true,
      nodeIntegrationInWorker: false,
    },
    width: windowState.width,
    x: windowState.x,
    y: windowState.y,
    ...(isDarwin ? {titleBarStyle: 'hiddenInset'} : {}),
  })
  win.loadURL(htmlFile)

  if (windowState.isFullScreen) {
    win.setFullScreen(true)
  }

  menuHelper(win)

  if (showDevTools && win.webContents) {
    win.webContents.openDevTools({mode: 'detach'})
  }

  registerForAppLinks()
  fixWindowsScalingIssue(win)
  maybeShowWindowOrDock(win)

  setupWindowEvents(win)
  return win
}
