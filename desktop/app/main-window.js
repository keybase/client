import Window from './window'
import {ipcMain} from 'electron'
import menuHelper from './menu-helper'
import resolveAssets from '../resolve-assets'
import hotPath from '../hot-path'

export default function () {
  const mainWindow = new Window(
    resolveAssets(`./renderer/index.html?src=${hotPath('index.bundle.js')}`), {
      width: 1600,
      height: 1200,
      openDevTools: true
    }
  )

  ipcMain.on('showMain', () => {
    mainWindow.show(true)
    menuHelper(mainWindow.window)
  })

  return mainWindow
}
