// @flow
import * as FsGen from './fs-gen'
import * as Saga from '../util/saga'
import fs from 'fs'
import * as Constants from '../constants/config'
import type {TypedState} from '../constants/reducer'
import {shell} from 'electron'
import {isLinux, isWindows} from '../constants/platform'
import {navigateTo, switchTo} from './route-tree'
import {fsTab} from '../constants/tabs'
import logger from '../logger'

// pathToURL takes path and converts to (file://) url.
// See https://github.com/sindresorhus/file-url
function pathToURL(path: string): string {
  let goodPath = path.replace(/\\/g, '/')

  // Windows drive letter must be prefixed with a slash
  if (goodPath[0] !== '/') {
    goodPath = '/' + goodPath
  }

  return encodeURI('file://' + goodPath).replace(/#/g, '%23')
}

function openInDefaultDirectory(openPath: string): Promise<*> {
  return new Promise((resolve, reject) => {
    // Paths in directories might be symlinks, so resolve using
    // realpath.
    // For example /keybase/private/gabrielh,chris gets redirected to
    // /keybase/private/chris,gabrielh.
    fs.realpath(openPath, (err, resolvedPath) => {
      if (err) {
        reject(new Error(`No realpath for ${openPath}: ${err}`))
        return
      }
      // Convert to URL for openExternal call.
      // We use openExternal instead of openItem because it
      // correctly focuses' the Finder, and also uses a newer
      // native API on macOS.
      const url = pathToURL(resolvedPath)
      logger.info('Open URL (directory):', url)

      shell.openExternal(url, {}, err => {
        if (err) {
          reject(err)
          return
        }
        logger.info('Opened directory:', openPath)
        resolve()
      })
    })
  })
}

function isDirectory(openPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.stat(openPath, (err, stats) => {
      if (err) {
        reject(new Error(`Unable to open/stat file: ${openPath}`))
        return
      }
      if (stats.isFile()) {
        resolve(false)
      } else if (stats.isDirectory()) {
        resolve(true)
      } else {
        reject(new Error(`Unable to open: Not a file or directory`))
      }
    })
  })
}

function _open(openPath: string): Promise<*> {
  return new Promise((resolve, reject) => {
    isDirectory(openPath).then(isDir => {
      if (isDir) {
        if (isWindows) {
          if (!shell.openItem(openPath)) {
            reject(new Error(`Unable to open item: ${openPath}`))
            return
          }
        } else {
          openInDefaultDirectory(openPath).then(resolve, reject)
          return
        }
      } else {
        if (!shell.showItemInFolder(openPath)) {
          reject(new Error(`Unable to open item in folder: ${openPath}`))
          return
        }
      }
      resolve()
    })
  })
}

export function openInFileUISaga({payload: {path}}: FsGen.OpenInFileUIPayload, state: TypedState) {
  const openPath = path || Constants.defaultKBFSPath
  const enabled = state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted
  if (isLinux || enabled) {
    return Saga.call(_open, openPath)
  } else {
    return Saga.sequentially([Saga.put(navigateTo([], [fsTab])), Saga.put(switchTo([fsTab]))])
  }
}
