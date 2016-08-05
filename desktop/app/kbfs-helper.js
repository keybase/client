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
      // If it's a file, don't open directly, show it selected in
      // Finder/Exporer.
      if (stats.isFile()) {
        shell.showItemInFolder(path)
      } else if (stats.isDirectory()) {
        // Paths in directories might be symlinks, so resolve using
        // realpath.
        // For example /keybase/private/gabrielh,chris gets redirected to
        // /keybase/private/chris,gabrielh.
        fs.realpath(path, (err, resolvedPath) => {
          if (err) {
            console.warn('No realpath for %s:', path, err)
            return
          }
          // Convert to URL for openExternal call.
          // We use openExternal instead of openItem because it
          // correctly focuses' the Finder, and also uses a newer
          // native API on macOS.
          const url = pathToURL(resolvedPath)
          console.log('Open URL (directory):', url)
          shell.openExternal(url)
        })
      }
    })
  })
}
