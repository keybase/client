import Window from './window'
import {ipcMain} from 'electron'
import {resolveRoot} from '../resolve-root'
import hotPath from '../hot-path'
import {globalResizing} from '../shared/styles/style-guide'
import isFirstTime from './first-time'

export default function () {
  const mainWindow = new Window(
    resolveRoot('renderer', `index.html?src=${hotPath('index.bundle.js')}`), {
      useContentSize: true,
      width: globalResizing.login.width,
      height: globalResizing.login.height,
      show: false,
    }
  )

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
