import Window from './window'
import {ipcMain} from 'electron'
import resolveRoot from '../resolve-root'
import hotPath from '../hot-path'
import {globalResizing} from '../shared/styles/style-guide'

export default function () {
  const mainWindow = new Window(
    resolveRoot(`renderer/index.html?src=${hotPath('index.bundle.js')}`), {
      useContentSize: true,
      width: globalResizing.login.width,
      height: globalResizing.login.height
    }
  )

  ipcMain.on('showMain', () => {
    mainWindow.show(true)
  })

  return mainWindow
}
