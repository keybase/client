import URL from 'url-parse'
import * as Electron from 'electron'
import * as ConfigGen from '../../actions/config-gen'
import * as fs from 'fs'
import menuHelper from './menu-helper.desktop'
import {mainWindowDispatch} from '../remote/util.desktop'
import {WindowState} from '../../constants/types/config'
import {showDevTools} from '../../local-debug.desktop'
import {showDockIcon, hideDockIcon} from './dock-icon.desktop'
import {dataRoot, isDarwin, isWindows, defaultUseNativeFrame} from '../../constants/platform'
import logger from '../../logger'
import {resolveRootAsURL} from './resolve-root.desktop'
import {debounce} from 'lodash-es'

const htmlFile = resolveRootAsURL('dist', `main${__DEV__ ? '.dev' : ''}.html`)

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

const windowState: WindowState = {
  dockHidden: false,
  height: 600,
  isFullScreen: false,
  isMaximized: false,
  openAtLogin: true,
  useNativeFrame: defaultUseNativeFrame,
  width: 800,
  windowHidden: false,
  x: 0,
  y: 0,
}

const setupWindowEvents = (win: Electron.BrowserWindow) => {
  const saveWindowState = debounce(() => {
    let winBounds = win.getBounds()
    if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) {
      windowState.x = winBounds.x
      windowState.y = winBounds.y
      windowState.width = winBounds.width
      windowState.height = winBounds.height
    }
    windowState.isMaximized = win.isMaximized()
    windowState.isFullScreen = win.isFullScreen()
    // windowState.displayBounds = Electron.screen.getDisplayMatching(winBounds).bounds
    windowState.windowHidden = !win.isVisible()

    console.log('aaaa saivng window state', windowState)
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
}

const loadWindowState = () => {
  const filename = dataRoot + 'gui_config.json'

  try {
    const s = fs.readFileSync(filename, {encoding: 'utf8'})
    const obj = JSON.parse(s)
    const {
      dockHidden,
      height,
      isFullScreen,
      isMaximized,
      openAtLogin,
      useNativeFrame,
      width,
      windowHidden,
      x,
      y,
    } = obj

    windowState.dockHidden = dockHidden || false
    windowState.height = height || 800
    windowState.isFullScreen = isFullScreen || false
    windowState.isMaximized = isMaximized || false
    windowState.openAtLogin = openAtLogin || Electron.app.getLoginItemSettings().wasOpenedAtLogin
    windowState.useNativeFrame = useNativeFrame === undefined ? defaultUseNativeFrame : useNativeFrame
    windowState.width = width || 600
    windowState.windowHidden = windowHidden || false
    windowState.x = x || 100
    windowState.y = y || 100
  } catch (e) {
    logger.info(`Couldn't load`, filename, ' continuing...')
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
  // logger.info('KEYBASE_AUTOSTART =', process.env['KEYBASE_AUTOSTART'])
  // logger.info('KEYBASE_START_UI =', process.env['KEYBASE_START_UI'])
  // logger.info('Opened at login:', openedAtLogin)
  // logger.info('Is restore:', isRestore)
  // logger.info('Open hidden:', openHidden)

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

// const checkOpenAtLogin = () => {
// if (__DEV__) {
// logger.info('Skipping auto login state change due to dev env. ')
// return
// }

// if (isDarwin || isWindows) {
// logger.info('Setting login item state', windowState.openAtLogin)
// Electron.app.setLoginItemSettings({openAtLogin: windowState.openAtLogin})
// }
// }

export default () => {
  setupDefaultSession()
  loadWindowState()
  // checkOpenAtLogin()

  const win = new Electron.BrowserWindow({
    frame: windowState.useNativeFrame,
    height: windowState.height,
    minHeight: 600,
    minWidth: 400,
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

  menuHelper(win)
  setupWindowEvents(win)

  if (showDevTools && win.webContents) {
    win.webContents.openDevTools({mode: 'detach'})
  }

  registerForAppLinks()
  fixWindowsScalingIssue(win)
  maybeShowWindowOrDock(win)

  return win
}
