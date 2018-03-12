// @flow
import * as FsGen from './fs-gen'
import * as Saga from '../util/saga'
import * as Constants from '../constants/config'
import * as RPCTypes from '../constants/types/rpc-gen'
import fs from 'fs'
import type {TypedState} from '../constants/reducer'
import {shell} from 'electron'
import {isLinux, isWindows} from '../constants/platform'
import {navigateTo, switchTo} from './route-tree'
import {fsTab} from '../constants/tabs'
import logger from '../logger'

type pathType = 'file' | 'directory'

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

function getPathType(openPath: string): Promise<pathType> {
  return new Promise((resolve, reject) => {
    fs.stat(openPath, (err, stats) => {
      if (err) {
        reject(new Error(`Unable to open/stat file: ${openPath}`))
        return
      }
      if (stats.isFile()) {
        resolve('file')
      } else if (stats.isDirectory()) {
        resolve('directory')
      } else {
        reject(new Error(`Unable to open: Not a file or directory`))
      }
    })
  })
}

function _open(openPath: string): Promise<*> {
  return new Promise((resolve, reject) => {
    getPathType(openPath).then(typ => {
      if (typ === 'directory') {
        if (isWindows) {
          if (!shell.openItem(openPath)) {
            reject(new Error(`Unable to open item: ${openPath}`))
            return
          }
        } else {
          openInDefaultDirectory(openPath).then(resolve, reject)
          return
        }
      } else if (typ === 'file') {
        if (!shell.showItemInFolder(openPath)) {
          reject(new Error(`Unable to open item in folder: ${openPath}`))
          return
        }
      } else {
        reject(new Error(`Invalid path type`))
        return
      }
      resolve()
    })
  })
}

export function openInFileUISaga({payload: {path}}: FsGen.OpenInFileUIPayload, state: TypedState) {
  const openPath = path || Constants.defaultKBFSPath
  const enabled = state.fs.fuseStatus && state.fs.fuseStatus.kextStarted
  if (isLinux || enabled) {
    return Saga.call(_open, openPath)
  } else {
    return Saga.sequentially([Saga.put(navigateTo([], [fsTab])), Saga.put(switchTo([fsTab]))])
  }
}

// TODO: uncomment
// function waitForMount(attempt: number): Promise<*> {
//   return new Promise((resolve, reject) => {
//     // Read the KBFS path waiting for files to exist, which means it's mounted
//     fs.readdir(Constants.defaultKBFSPath, (err, files) => {
//       if (!err && files.length > 0) {
//         resolve(true)
//       } else if (attempt > 15) {
//         reject(new Error(`${Constants.defaultKBFSPath} is unavailable. Please try again.`))
//       } else {
//         setTimeout(() => {
//           waitForMount(attempt + 1).then(resolve, reject)
//         }, 1000)
//       }
//     })
//   })
// }
//
// function* waitForMountAndOpenSaga(): Saga.SagaGenerator<any, any> {
//   yield Saga.put(FsGen.createSetOpening({opening: true}))
//   try {
//     yield Saga.call(waitForMount, 0)
//     // TODO: switch to reimplemented `openWithCurrenMountDir`
//     yield Saga.put(FsGen.createOpenInFileUI({payload: {path: Constants.defaultKBFSPath}}))
//   } finally {
//     yield Saga.put(FsGen.createSetOpening({opening: false}))
//   }
// }
//
// function* installKBFSSaga(): Saga.SagaGenerator<any, any> {
//   const result: RPCTypes.InstallResult = yield Saga.call(RPCTypes.installInstallKBFSRpcPromise)
//   yield Saga.put(FsGen.createInstallKBFSResult({result}))
//   yield Saga.put(FsGen.createSetOpening({opening: true}))
//   yield Saga.put(FsGen.createInstallKBFSFinished())
//   yield Saga.call(waitForMountAndOpenSaga)
// }

export function fuseStatusResultSaga({payload: {prevStatus, status}}: FsGen.FuseStatusResultPayload) {
  // If our kextStarted status changed, finish KBFS install
  // TODO: uncomment; commented for now until we plug in KBFS installation.
  // if (status.kextStarted && prevStatus && !prevStatus.kextStarted) {
  //   return Saga.call(installKBFSSaga)
  // }
}

export function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const prevStatus = state.favorite.fuseStatus

  let status = yield Saga.call(RPCTypes.installFuseStatusRpcPromise, {bundleVersion: ''})
  if (isWindows && status.installStatus !== 4) {
    // Check if another Dokan we didn't install mounted the filesystem
    const kbfsMount = yield Saga.call(RPCTypes.kbfsMountGetCurrentMountDirRpcPromise)
    if (kbfsMount && fs.existsSync(kbfsMount)) {
      status.installStatus = 4 // installed
      status.installAction = 1 // none
      status.kextStarted = true
    }
  }
  yield Saga.put(FsGen.createFuseStatusResult({prevStatus, status}))
}
