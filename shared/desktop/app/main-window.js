// @flow
import AppState from './app-state'
import Window from './window'
import getenv from 'getenv'
import hotPath from '../hot-path'
import {app, ipcMain} from 'electron'
import {showDevTools} from '../../local-debug.desktop'
import {hideDockIcon} from './dock-icon'
import {injectReactQueryParams} from '../../util/dev'
import {resolveRootAsURL} from '../resolve-root'
import {windowStyle} from '../../styles'
import {isWindows} from '../../constants/platform'

export default function() {
  let appState = new AppState()
  appState.checkOpenAtLogin()

  const mainWindow = new Window(
    resolveRootAsURL('renderer', injectReactQueryParams('renderer.html?mainWindow')),
    {
      backgroundThrottling: false,
      height: appState.state.height,
      minHeight: windowStyle.minHeight,
      minWidth: windowStyle.minWidth,
      show: false,
      width: appState.state.width,
      x: appState.state.x,
      y: appState.state.y,
    }
  )

  const webContents = mainWindow.window.webContents
  webContents.on('did-finish-load', () => {
    webContents.send('load', {
      scripts: [
        {
          async: false,
          src: hotPath('index.bundle.js'),
        },
      ],
    })
  })

  if (showDevTools) {
    webContents.openDevTools('detach')
  }

  appState.manageWindow(mainWindow.window)

  const openedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin
  // app.getLoginItemSettings().restoreState is Mac only, so consider it always on in Windows
  const isRestore =
    getenv.boolish('KEYBASE_RESTORE_UI', false) || app.getLoginItemSettings().restoreState || isWindows
  const hideWindowOnStart = getenv.string('KEYBASE_START_UI', '') === 'hideWindow'
  const openHidden = app.getLoginItemSettings().wasOpenedAsHidden
  console.log('Opened at login:', openedAtLogin)
  console.log('Is restore:', isRestore)
  console.log('Open hidden:', openHidden)
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
      x: appState.state.x,
      y: appState.state.y,
      width: appState.state.width,
      height: appState.state.height,
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

  console.log('Hide main window:', hideMainWindow)
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
  console.log('Hide dock icon:', shouldHideDockIcon)
  if (shouldHideDockIcon) {
    hideDockIcon()
  }

  ipcMain.on('showMain', () => {
    console.log('Show main window (requested)')
    mainWindow.show()
    const window = mainWindow.window
    if (window) {
      window.focus()
      console.log('...showMain: visible=', window.isVisible(), window.getBounds())
    } else {
      console.log('...showMain: no mainWindow!')
    }
  })

  return mainWindow
}
