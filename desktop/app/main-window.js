import Window from './window'
import {app, ipcMain} from 'electron'
import {resolveRoot} from '../resolve-root'
import hotPath from '../hot-path'
import {windowStyle} from '../shared/styles'
import {forceMainWindowPosition} from '../shared/local-debug.desktop'
import AppState from './app-state'
import getenv from 'getenv'
import {hideDockIcon} from './dock-icon'

export default function () {
  let appState = new AppState({
    defaultWidth: windowStyle.width,
    defaultHeight: windowStyle.height,
  })
  appState.checkOpenAtLogin()

  const mainWindow = new Window(
    resolveRoot('renderer', `index.html?src=${hotPath('index.bundle.js')}`), {
      x: appState.state.x,
      y: appState.state.y,
      width: appState.state.width,
      height: appState.state.height,
      minWidth: windowStyle.minWidth,
      minHeight: windowStyle.minHeight,
      show: false,
    }
  )

  appState.manageWindow(mainWindow.window)

  if (__DEV__ && forceMainWindowPosition) {
    mainWindow.window.setPosition(forceMainWindowPosition.x, forceMainWindowPosition.y)
  }

  const isRestore = getenv.boolish('KEYBASE_RESTORE_UI', false) || app.getLoginItemSettings().restoreState
  const openHidden = (getenv.string('KEYBASE_START_UI', '') === 'hideWindow') || app.getLoginItemSettings().wasOpenedAsHidden

  // We show the main window on startup if:
  //  - We are restoring UI and the window was previously visible (in app state)
  //  - and, we are not set to open hidden
  const showMainWindow = (isRestore && !appState.state.windowHidden) && !openHidden
  console.log('Show main window: %s', showMainWindow)
  if (showMainWindow) {
    // On Windows we can try showing before Windows is ready
    // This will result in a dropped .show request
    // We add a listener to `did-finish-load` so we can show it when
    // Windows is ready.
    mainWindow.show(true)
    mainWindow.window.webContents.once('did-finish-load', () => {
      mainWindow.show(true)
    })
  }

  // Hide the dock icon if:
  // - We are not restoring
  // - or, we are restoring and dock was hidden
  // - or, we are set to open hidden
  const shouldHideDockIcon = !isRestore || (isRestore && appState.state.dockHidden) || openHidden
  console.log('Hide dock icon: %s', shouldHideDockIcon)
  if (shouldHideDockIcon) {
    hideDockIcon()
  }

  ipcMain.on('showMain', () => {
    console.log('Show main window (requested)')
    mainWindow.show(true)
  })

  ipcMain.on('tabChanged', (event, tab) => {
    appState.state.tab = tab
    appState.saveState()
  })

  return mainWindow
}
