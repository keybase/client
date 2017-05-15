// @flow
import AppState from './app-state'
import Window from './window'
import getenv from 'getenv'
import hotPath from '../hot-path'
import {app, ipcMain} from 'electron'
import {forceMainWindowPosition, showDevTools} from '../../local-debug.desktop'
import {hideDockIcon} from './dock-icon'
import {injectReactQueryParams} from '../../util/dev'
import {resolveRootAsURL} from '../resolve-root'
import {windowStyle} from '../../styles'

export default function() {
  let appState = new AppState({
    defaultWidth: windowStyle.width,
    defaultHeight: windowStyle.height,
  })
  appState.checkOpenAtLogin()

  const mainWindow = new Window(
    resolveRootAsURL('renderer', injectReactQueryParams('renderer.html?mainWindow')),
    {
      x: appState.state.x,
      y: appState.state.y,
      width: appState.state.width,
      height: appState.state.height,
      minWidth: windowStyle.minWidth,
      minHeight: windowStyle.minHeight,
      show: false,
    }
  )

  const webContents = mainWindow.window.webContents
  webContents.on('did-finish-load', () => {
    webContents.send('load', {
      scripts: [
        ...(__DEV__
          ? [
              {
                src: resolveRootAsURL('dist', 'dll/dll.vendor.js'),
                async: false,
              },
            ]
          : []),
        {
          src: hotPath('index.bundle.js'),
          async: false,
        },
      ],
    })
  })

  if (showDevTools) {
    webContents.openDevTools('detach')
  }

  appState.manageWindow(mainWindow.window)

  if (__DEV__ && forceMainWindowPosition) {
    mainWindow.window.setPosition(forceMainWindowPosition.x, forceMainWindowPosition.y)
  }

  const openedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin
  const isRestore =
    getenv.boolish('KEYBASE_RESTORE_UI', false) || app.getLoginItemSettings().restoreState
  const hideWindowOnStart = getenv.string('KEYBASE_START_UI', '') === 'hideWindow'
  const openHidden = app.getLoginItemSettings().wasOpenedAsHidden
  console.log('Opened at login:', openedAtLogin)
  console.log('Is restore:', isRestore)
  console.log('Open hidden:', openHidden)

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
    mainWindow.show(true)
    mainWindow.window.webContents.once('did-finish-load', () => {
      mainWindow.show(true)
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
    mainWindow.show(true)
    mainWindow.window && mainWindow.window.focus()
  })

  return mainWindow
}
