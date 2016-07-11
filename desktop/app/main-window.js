import Window from './window'
import {ipcMain} from 'electron'
import {resolveRoot} from '../resolve-root'
import hotPath from '../hot-path'
import {windowStyle} from '../shared/styles/style-guide'
import isFirstTime from './first-time'
import {forceMainWindowPosition} from '../shared/local-debug.desktop'
import windowState from 'electron-window-state'

export default function () {
  let mainWindowState = windowState({
    defaultWidth: windowStyle.width,
    defaultHeight: windowStyle.height,
  })

  const mainWindow = new Window(
    resolveRoot('renderer', `index.html?src=${hotPath('index.bundle.js')}`), {
      x: mainWindowState.x,
      y: mainWindowState.y,
      width: mainWindowState.width,
      height: mainWindowState.height,
      minWidth: windowStyle.minWidth,
      minHeight: windowStyle.minHeight,
      show: false,
    }
  )

  mainWindowState.manage(mainWindow.window)

  if (__DEV__ && forceMainWindowPosition) {
    mainWindow.window.setPosition(forceMainWindowPosition.x, forceMainWindowPosition.y)
  }

  isFirstTime.then(firstTime => {
    if (firstTime) {
      mainWindow.show(true)
      mainWindow.window.webContents.once('did-finish-load', () => {
        mainWindow.show(true)
      })
    }
  }).catch(err => {
    console.log('err in showing main window:', err)
  })

  ipcMain.on('showMain', () => {
    mainWindow.show(true)
  })

  return mainWindow
}
