// @flow

import {ipcMain, shell} from 'electron'

export default function () {
  ipcMain.on('openInKBFS', (e, path) => {
    shell.showItemInFolder(path)
  })
}
