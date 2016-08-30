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

  const openedAtLogin = app.getLoginItemSettings().openAtLogin
  const isRestore = getenv.boolish('KEYBASE_RESTORE_UI', false) || app.getLoginItemSettings().restoreState
  const openHidden = (getenv.string('KEYBASE_START_UI', '') === 'hideWindow') || app.getLoginItemSettings().wasOpenedAsHidden

  // Don't show main window:
  // - If we are set to open hidden,
  // - or, if we are restoring and window was hidden
  // - or, if we are opening from login (but not restoring)
  const hideMainWindow = openHidden || (isRestore && appState.state.windowHidden) || (openedAtLogin && !isRestore)

  console.log('Hide main window: %s', hideMainWindow)
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
  // - or, if we are opening from login (but not restoring)
  const shouldHideDockIcon = openHidden || (isRestore && appState.state.dockHidden) || (openedAtLogin && !isRestore)
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
