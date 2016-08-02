// @flow

import {ipcMain, shell} from 'electron'
import fs from 'fs'
import {pathToURL} from './paths'

export default function () {
  ipcMain.on('openInKBFS', (e, path) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        console.warn('Error opening %s:', path, err)
        return
      }
      if (stats.isFile()) {
        shell.showItemInFolder(path)
      } else if (stats.isDirectory()) {
        // Paths if directories might be symlinks.
        // For example /keybase/private/gabrielh,chris gets redirected to
        // /keybase/private/chris,gabrielh.
        fs.realpath(path, (err, resolvedPath) => {
          if (err) {
            console.warn('No realpath for %s:', path, err)
            return
          }
          const url = pathToURL(resolvedPath)
          console.log('Open URL (directory):', url)
          shell.openExternal(url)
        })
      }
    })
  })
}
