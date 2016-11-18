// @flow
import exec from './exec'
import fs from 'fs'
import {ipcMain, shell} from 'electron'
// $FlowIssue doesn't understand symlinks
import {isDarwin, isWindows} from '../shared/constants/platform'
import {pathToURL} from './paths'

function openDirectory (path) {
  if (isWindows) {
    openDirectoryInWindows(path)
  } else {
    openDirectoryDefault(path)
  }
}

function openDirectoryInWindows (path) {
  shell.openItem(path)
}

function openDirectoryDefault (path) {
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

    // OpenExternal is blocking on macOS.
    // Here is a discussion to make it asynchronous:
    // https://github.com/electron/electron/issues/6889
    // When this is resolved we should switch back to openExternal
    // instead of exec'ing with open.
    if (isDarwin) {
      openURLWithExecInMacOS(url)
    } else {
      shell.openExternal(url)
    }
  })
}

function openURLWithExecInMacOS (url) {
  exec('/usr/bin/open', [`"${url}"`], 'darwin', null, false, (err) => {
    if (err) {
      console.log('Error opening URL:', err)
    }
  })
}

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
        openDirectory(path)
      }
    })
  })
}
