// @flow

import {ipcMain, shell} from 'electron'
import {pathToURL} from './paths'

export default function () {
  ipcMain.on('openInKBFS', (e, path) => {
    // shell.showItemInFolder(path)
    let url = pathToURL(path)
    console.log('Open URL:', url)
    shell.openExternal(url)
  })
}
