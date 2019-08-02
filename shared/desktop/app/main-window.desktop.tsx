import URL from 'url-parse'
import AppState from '../../app/app-state.desktop'
import Window from './window.desktop'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {showDevTools} from '../../local-debug.desktop'
import {hideDockIcon} from './dock-icon.desktop'
import {isDarwin, isWindows, defaultUseNativeFrame} from '../../constants/platform'
import logger from '../../logger'
import {resolveRootAsURL} from './resolve-root.desktop'

const htmlFile = resolveRootAsURL('dist', `main${__DEV__ ? '.dev' : ''}.html`)

export default function() {
  const ds = SafeElectron.getSession().defaultSession
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

  let appState = new AppState()
  appState.checkOpenAtLogin()

  const mainWindow = new Window(htmlFile, {
    backgroundThrottling: false,
    // Auto generated from flowToTs. Please clean me!
    frame:
      appState.state.useNativeFrame !== null && appState.state.useNativeFrame !== undefined
        ? appState.state.useNativeFrame
        : defaultUseNativeFrame,
    height: appState.state.height,
    minHeight: 600,
    minWidth: 400,
    show: false,
    webPreferences: {
      devTools: showDevTools,
      nodeIntegration: true,
      nodeIntegrationInWorker: false,
    },
    width: appState.state.width,
    x: appState.state.x,
    y: appState.state.y,
    ...(isDarwin ? {titleBarStyle: 'hiddenInset'} : {}),
  })

  const webContents = mainWindow.window.webContents

  if (showDevTools) {
    webContents.openDevTools({mode: 'detach'})
  }

  appState.manageWindow(mainWindow.window)

  const app = SafeElectron.getApp()
  // Register for SEP7 and Keybase links.
  app.setAsDefaultProtocolClient('web+stellar')
  app.setAsDefaultProtocolClient('keybase')

  const openedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin
  // app.getLoginItemSettings().restoreState is Mac only, so consider it always on in Windows
  const isRestore =
    !!process.env['KEYBASE_RESTORE_UI'] || app.getLoginItemSettings().restoreState || isWindows
  const hideWindowOnStart = process.env['KEYBASE_AUTOSTART'] === '1'
  const openHidden = app.getLoginItemSettings().wasOpenedAsHidden
  logger.info('KEYBASE_AUTOSTART =', process.env['KEYBASE_AUTOSTART'])
  logger.info('KEYBASE_START_UI =', process.env['KEYBASE_START_UI'])
  logger.info('Opened at login:', openedAtLogin)
  logger.info('Is restore:', isRestore)
  logger.info('Open hidden:', openHidden)
  if (
    isWindows &&
    appState &&
    appState.state &&
    typeof appState.state.x === 'number' &&
    typeof appState.state.y === 'number' &&
    typeof appState.state.width === 'number' &&
    typeof appState.state.height === 'number'
  ) {
    // DPI scaling issues
    // https://github.com/electron/electron/issues/10862
    mainWindow.window.setBounds({
      height: appState.state.height,
      width: appState.state.width,
      x: appState.state.x,
      y: appState.state.y,
    })
  }

  // Don't show main window:
  // - If we are set to open hidden,
  // - or, if we hide window on start,
  // - or, if we are restoring and window was hidden
  // - or, if we were opened from login (but not restoring)
  const hideMainWindow =
    openHidden ||
    hideWindowOnStart ||
    (isRestore && appState.state.windowHidden) ||
    (openedAtLogin && !isRestore)

  logger.info('Hide main window:', hideMainWindow)
  if (!hideMainWindow) {
    // On Windows we can try showing before Windows is ready
    // This will result in a dropped .show request
    // We add a listener to `did-finish-load` so we can show it when
    // Windows is ready.
    mainWindow.show()
    mainWindow.window.webContents.once('did-finish-load', () => {
      mainWindow.show()
    })
  }

  // Don't show dock:
  // - If we are set to open hidden,
  // - or, if we are restoring and dock was hidden
  // - or, if we were opened from login (but not restoring)
  const shouldHideDockIcon =
    openHidden || (isRestore && appState.state.dockHidden) || (openedAtLogin && !isRestore)
  logger.info('Hide dock icon:', shouldHideDockIcon)
  if (shouldHideDockIcon) {
    hideDockIcon()
  }

  SafeElectron.getIpcMain().on('showMain', () => {
    logger.info('Show main window (requested)')
    mainWindow.show()
    const window = mainWindow.window
    if (window) {
      window.focus()
      logger.info('...showMain: visible=', window.isVisible(), window.getBounds())
    } else {
      logger.info('...showMain: no mainWindow!')
    }
  })

  return mainWindow
}
