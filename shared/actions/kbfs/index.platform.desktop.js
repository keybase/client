// @flow
import * as Constants from '../../constants/config'
import path from 'path'
import fs from 'fs'
import {kbfsMountGetCurrentMountDirRpcPromise} from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {shell} from 'electron'
import {isWindows} from '../../constants/platform'

import type {FSOpen} from '../../constants/kbfs'
import type {SagaGenerator} from '../../constants/types/saga'
import type {AsyncAction} from '../../constants/types/flux'

// pathToURL takes path and converts to (file://) url.
// See https://github.com/sindresorhus/file-url
function pathToURL (path: string): string {
  path = path.replace(/\\/g, '/')

  // Windows drive letter must be prefixed with a slash
  if (path[0] !== '/') {
    path = '/' + path
  }

  return encodeURI('file://' + path).replace(/#/g, '%23')
}

function openInDefault (openPath: string): Promise<*> {
  return new Promise((resolve, reject) => {
    console.log('openInDefault:', openPath)
    // Path resolve removes any ..
    openPath = path.resolve(openPath)
    // Paths MUST start with defaultKBFSPath
    if (!openPath.startsWith(Constants.defaultKBFSPath)) {
      reject(new Error(`openInKBFS requires ${Constants.defaultKBFSPath} prefix: ${openPath}`))
      return
    }

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
      console.log('Open URL (directory):', url)

      shell.openExternal(url, {}, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  })
}

function * openInWindows (openPath: string): SagaGenerator<any, any> {
  if (!openPath.startsWith(Constants.defaultKBFSPath)) {
    throw new Error(`openInKBFS requires ${Constants.defaultKBFSPath} prefix: ${openPath}`)
  }
  openPath = openPath.slice(Constants.defaultKBFSPath.length)

  let kbfsPath = yield select(state => state.config.kbfsPath)

  // On windows the path isn't /keybase
  // We can figure it out by looking at the extendedConfig though
  if (kbfsPath === Constants.defaultKBFSPath) {
    // make call
    kbfsPath = yield call(kbfsMountGetCurrentMountDirRpcPromise)

    if (!kbfsPath) {
      throw new Error('No kbfsPath')
    }

    yield put({type: Constants.changeKBFSPath, payload: {path: kbfsPath}})
  }

  if (!kbfsPath) {
    throw new Error('No kbfsPath')
  }

  openPath = path.resolve(kbfsPath, openPath)
  // Check to make sure our resolved path starts with the kbfsPath
  // i.e. (not opening a folder outside kbfs)
  if (!openPath.startsWith(kbfsPath)) {
    throw new Error(`openInKBFS requires ${kbfsPath} prefix: ${openPath}`)
  }
  shell.openItem(openPath)
}

function * openSaga (action: FSOpen): SagaGenerator<any, any> {
  const openPath = action.payload.path || Constants.defaultKBFSPath

  console.log('openInKBFS:', openPath)
  if (isWindows) {
    yield * openInWindows(openPath)
  } else {
    yield call(openInDefault, openPath)
  }
}

export {
  openSaga,
}
