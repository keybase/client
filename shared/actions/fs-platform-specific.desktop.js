// @flow
import * as FsGen from './fs-gen'
import * as Saga from '../util/saga'
import * as Constants from '../constants/config'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/fs'
import fs from 'fs'
import {delay} from 'redux-saga'
import {ExitCodeFuseKextPermissionError} from '../constants/fs'
import type {TypedState} from '../constants/reducer'
import {shell, electron} from 'electron'
import {isLinux, isWindows} from '../constants/platform'
import {navigateTo} from './route-tree'
import {fsTab} from '../constants/tabs'
import logger from '../logger'
import {spawn, execFileSync} from 'child_process'
import path from 'path'

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
    return Saga.put(navigateTo([fsTab, {props: {path: Types.stringToPath(openPath)}, selected: 'folder'}]))
  }
}

function waitForMount(attempt: number): Promise<*> {
  return new Promise((resolve, reject) => {
    // Read the KBFS path waiting for files to exist, which means it's mounted
    // TODO: should handle current mount directory
    fs.readdir(Constants.defaultKBFSPath, (err, files) => {
      if (!err && files.length > 0) {
        resolve(true)
      } else if (attempt > 15) {
        reject(new Error(`${Constants.defaultKBFSPath} is unavailable. Please try again.`))
      } else {
        setTimeout(() => {
          waitForMount(attempt + 1).then(resolve, reject)
        }, 1000)
      }
    })
  })
}

function* waitForMountAndOpenSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.put(FsGen.createSetFlags({kbfsOpening: true}))
  try {
    yield Saga.call(waitForMount, 0)
    // TODO: should handle current mount directory
    yield Saga.put(FsGen.createOpenInFileUI({payload: {path: Constants.defaultKBFSPath}}))
  } finally {
    yield Saga.put(FsGen.createSetFlags({kbfsOpening: false}))
  }
}

export function* installKBFSSaga(): Saga.SagaGenerator<any, any> {
  const result: RPCTypes.InstallResult = yield Saga.call(RPCTypes.installInstallKBFSRpcPromise)
  yield Saga.put(FsGen.createInstallKBFSResult({result}))
  yield Saga.put(FsGen.createSetFlags({kbfsOpening: true, kbfsInstalling: false}))
  yield Saga.call(waitForMountAndOpenSaga)
}

export function fuseStatusResultSaga({payload: {prevStatus, status}}: FsGen.FuseStatusResultPayload) {
  // If our kextStarted status changed, finish KBFS install
  if (status.kextStarted && prevStatus && !prevStatus.kextStarted) {
    return Saga.call(installKBFSSaga)
  }
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

export function* installFuseSaga(): Saga.SagaGenerator<any, any> {
  const result: RPCTypes.InstallResult = yield Saga.call(RPCTypes.installInstallFuseRpcPromise)
  const fuseResults =
    result && result.componentResults ? result.componentResults.filter(c => c.name === 'fuse') : []
  const kextPermissionError =
    fuseResults.length > 0 && fuseResults[0].exitCode === ExitCodeFuseKextPermissionError

  if (kextPermissionError) {
    // Add a small delay here, since on 10.13 the OS will be a little laggy
    // when showing a kext permission error.
    yield delay(1e3)
  }

  yield Saga.put(FsGen.createInstallFuseResult({kextPermissionError}))
  yield Saga.put(FsGen.createFuseStatus())
  yield Saga.put(FsGen.createSetFlags({fuseInstalling: false}))
}

export function uninstallKBFSSaga() {
  return Saga.call(RPCTypes.installUninstallKBFSRpcPromise)
}

export function uninstallKBFSSagaSuccess(result: RPCTypes.UninstallResult) {
  // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
  const app = electron.remote.app
  app.relaunch()
  app.exit(0)
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
function installCachedDokan(): Promise<*> {
  return new Promise((resolve, reject) => {
    // use the action logger so it has a chance of making it into the upload
    logger.action('Invoking dokan installer')
    const dokanPath = path.resolve(String(process.env.LOCALAPPDATA), 'Keybase', 'DokanSetup_redist.exe')
    try {
      execFileSync(dokanPath, [])
    } catch (err) {
      logger.error('installCachedDokan caught', err)
      reject(err)
      return
    }
    // restart the servie, particularly kbfsdokan
    // based on desktop/app/start-win-service.js
    const binPath = path.resolve(String(process.env.LOCALAPPDATA), 'Keybase', 'keybase.exe')
    if (!binPath) {
      return
    }
    const rqPath = binPath.replace('keybase.exe', 'keybaserq.exe')
    const args = [binPath, 'ctl', 'watchdog2']

    spawn(rqPath, args, {
      detached: true,
      stdio: 'ignore',
    })

    resolve()
  })
}

export function installDokanSaga() {
  return Saga.call(installCachedDokan)
}
