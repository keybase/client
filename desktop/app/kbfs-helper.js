// @flow

import {ipcMain} from 'electron'
import {shell} from 'electron'

export default function () {
  ipcMain.on('openInKBFS', (e, path) => {
    // We do the `shell.openItem` here to not block the ui thread
    shell.openItem(path)
  })
}
