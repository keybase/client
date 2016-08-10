import Window from './window'
import {ipcMain} from 'electron'
import {resolveRoot} from '../resolve-root'
import hotPath from '../hot-path'
import {windowStyle} from '../shared/styles/style-guide'
import {forceMainWindowPosition} from '../shared/local-debug.desktop'
import AppState from './app-state'
import getenv from 'getenv'
import {hideDockIcon} from './dock-icon'

export default function () {
  let appState = new AppState({
    defaultWidth: windowStyle.width,
    defaultHeight: windowStyle.height,
  })

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

  const isRestore = getenv.boolish('KEYBASE_RESTORE_UI', false)
  const startUI = getenv.string('KEYBASE_START_UI', '')
  console.log('Main window, isRestore: %s, startUI: %s', isRestore, startUI)

  // We show the main window on startup if:
  //  - We are not restoring the UI (after update, or boot)
  //    Or, we are restoring UI and the window was previously visible (in app state)
  //  - And, startUI is not set to 'hideWindow'.
  const showMainWindow = (!isRestore || (isRestore && !appState.state.windowHidden)) && (startUI !== 'hideWindow')
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

  const shouldHideDockIcon = (isRestore && appState.state.dockHidden)
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
