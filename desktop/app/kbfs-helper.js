// @flow

import {ipcMain, shell} from 'electron'
import fs from 'fs'
import {pathToURL} from './paths'

export default function () {
  ipcMain.on('openInKBFS', (e, path) => {
    console.warn(`${new Date()} - Pre fs.stat`)
    fs.stat(path, (err, stats) => {
      console.warn(`${new Date()} - Post fs.stat`)
      if (err) {
        console.warn(`${new Date()} - Error opening %s:`, path, err)
        return
      }
      if (console.warn(`${new Date()} - Pre stat.isFile`) || stats.isFile() && !(console.warn(`${new Date()} - Post stat.isFile`))) {
        shell.showItemInFolder(path)
      } else if (console.warn(`${new Date()} - Pre stat.isDirectory`) || stats.isDirectory() && !(console.warn(`${new Date()} - Post stat.isDirectory`))) {
        // Paths if directories might be symlinks.
        // For example /keybase/private/gabrielh,chris gets redirected to
        // /keybase/private/chris,gabrielh.
        console.warn(`${new Date()} - Pre fs.realpath`)
        fs.realpath(path, (err, resolvedPath) => {
          console.warn(`${new Date()} - Post fs.realpath`)
          if (err) {
            console.warn('No realpath for %s:', path, err)
            return
          }
          const url = pathToURL(resolvedPath)
          console.warn(`${new Date()} - Post pathToUrl`)
          console.log('Open URL (directory):', url)
          shell.openExternal(url)
          console.warn(`${new Date()} - Post openExternal`)
        })
      }
    })
  })
}
