import Window from './window'
import {ipcMain} from 'electron'
import {resolveRoot} from '../resolve-root'
import hotPath from '../hot-path'
import {windowStyle} from '../shared/styles/style-guide'
import {forceMainWindowPosition} from '../shared/local-debug.desktop'
import AppState from './app-state'
import getenv from 'getenv'

export default function () {
  let appState = new AppState({
    defaultWidth: windowStyle.width,
    defaultHeight: windowStyle.height,
  })

  const mainWindow = new Window(
    resolveRoot('renderer', `index.html?src=${hotPath('index.bundle.js')}`), {
      x: appState.x,
      y: appState.y,
      width: appState.width,
      height: appState.height,
      minWidth: windowStyle.minWidth,
      minHeight: windowStyle.minHeight,
      show: false,
    }
  )

  appState.manageWindow(mainWindow.window)

  if (__DEV__ && forceMainWindowPosition) {
    mainWindow.window.setPosition(forceMainWindowPosition.x, forceMainWindowPosition.y)
  }

  let windowVisibility = getenv.string('KEYBASE_WINDOW_VISIBILITY', '')
  let useAppStateForWindowVisibility = (windowVisibility === 'appState')
  if (!useAppStateForWindowVisibility || (useAppStateForWindowVisibility && !appState.windowHidden)) {
    // On Windows we can try showing before Windows is ready
    // This will result in a dropped .show request
    // We add a listener to `did-finish-load` so we can show it when
    // Windows is ready.
    mainWindow.show(true)
    mainWindow.window.webContents.once('did-finish-load', () => {
      mainWindow.show(true)
    })
  }

  ipcMain.on('showMain', () => {
    mainWindow.show(true)
  })

  ipcMain.on('tabChanged', (event, tab) => {
    appState.tab = tab
  })

  return mainWindow
}
