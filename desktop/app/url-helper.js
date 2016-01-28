import {ipcMain, shell} from 'electron'
import * as linkFuncs from '../shared/constants/urls'

export default function () {
  ipcMain.on('openURL', (event, type, params) => {
    const linkFunc = linkFuncs[type]
    if (linkFunc) {
      const link = linkFunc(params)
      if (link) {
        shell.openExternal(link)
      }
    }
  })
}
