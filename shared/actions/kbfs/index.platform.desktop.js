// @flow
import * as ConfigGen from '../config-gen'
import * as KBFSGen from '../kbfs-gen'
import * as Constants from '../../constants/config'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/flow-types'
import electron, {shell} from 'electron'
import fs from 'fs'
import path from 'path'
import {ExitCodeFuseKextPermissionError} from '../../constants/favorite'
import {delay} from 'redux-saga'
import {execFile} from 'child_process'
import {folderTab} from '../../constants/tabs'
import {isLinux, isWindows} from '../../constants/platform'
import {navigateTo, switchTo} from '../route-tree'
import type {TypedState} from '../../constants/reducer'

// pathToURL takes path and converts to (file://) url.
// See https://github.com/sindresorhus/file-url
function pathToURL(path: string): string {
  path = path.replace(/\\/g, '/')

  // Windows drive letter must be prefixed with a slash
  if (path[0] !== '/') {
    path = '/' + path
  }

  return encodeURI('file://' + path).replace(/#/g, '%23')
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
      console.log('Open URL (directory):', url)

      shell.openExternal(url, {}, err => {
        if (err) {
          reject(err)
          return
        }
        console.log('Opened directory:', openPath)
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
      if (isDir && isWindows) {
        if (!shell.openItem(openPath)) {
          reject(new Error(`Unable to open item: ${openPath}`))
        }
      } else if (isDir) {
        openInDefaultDirectory(openPath).then(resolve, reject)
      } else {
        if (!shell.showItemInFolder(openPath)) {
          reject(new Error(`Unable to open item in folder: ${openPath}`))
        }
      }

      resolve()
    })
  })
}

function openInDefault(openPath: string): Promise<*> {
  console.log('openInDefault:', openPath)
  // Path resolve removes any ..
  openPath = path.resolve(openPath)
  // Paths MUST start with defaultKBFSPath
  if (!openPath.startsWith(Constants.defaultKBFSPath)) {
    throw new Error(`openInDefault requires ${Constants.defaultKBFSPath} prefix: ${openPath}`)
  }

  return _open(openPath)
}

function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {
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
  yield Saga.put(KBFSGen.createFuseStatusUpdate({prevStatus, status}))
}

function fuseStatusUpdateSaga({payload: {prevStatus, status}}: KBFSGen.FuseStatusUpdatePayload) {
  // If our kextStarted status changed, finish KBFS install
  if (status.kextStarted && prevStatus && !prevStatus.kextStarted) {
    return Saga.call(installKBFSSaga)
  }
}

function* installFuseSaga(): Saga.SagaGenerator<any, any> {
  const result: RPCTypes.InstallResult = yield Saga.call(RPCTypes.installInstallFuseRpcPromise)
  const fuseResults = result && result.componentResults
    ? result.componentResults.filter(c => c.name === 'fuse')
    : []
  const kextPermissionError =
    fuseResults.length > 0 && fuseResults[0].exitCode === ExitCodeFuseKextPermissionError

  if (kextPermissionError) {
    // Add a small delay here, since on 10.13 the OS will be a little laggy
    // when showing a kext permission error.
    yield delay(1e3)
  }

  yield Saga.put(KBFSGen.createInstallFuseResult({kextPermissionError}))
  yield Saga.put(KBFSGen.createFuseStatus())
  yield Saga.put(KBFSGen.createInstallFuseFinished())
}

function findKeybaseUninstallString(): Promise<string> {
  console.log('findKeybaseUninstallString')
  return new Promise((resolve, reject) => {
    const regedit = require('regedit')
    const keybaseRegPath = 'HKCU\\SOFTWARE\\Keybase\\Keybase'
    try {
      regedit.list(keybaseRegPath).on('data', function(entry) {
        console.log('findKeybaseUninstallString on data')
        if (entry.data.values && entry.data.values.BUNDLEKEY) {
          const uninstallRegPath =
            'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\' +
            entry.data.values.BUNDLEKEY.value

          regedit.list(uninstallRegPath).on('data', function(entry) {
            console.log('findKeybaseUninstallString on data of', uninstallRegPath)
            if (
              entry.data.values &&
              entry.data.values.DisplayName &&
              entry.data.values.DisplayName.value === 'Keybase' &&
              entry.data.values.Publisher &&
              entry.data.values.Publisher.value === 'Keybase, Inc.' &&
              entry.data.values.ModifyPath &&
              entry.data.values.BundleCachePath
            ) {
              if (fs.existsSync(entry.data.values.BundleCachePath.value)) {
                var modifyPath = entry.data.values.ModifyPath.value
                // Remove double quotes - won't work otherwise
                modifyPath = modifyPath.replace(/"/g, '')
                // Remove /modify and send it in with the other arguments, below
                modifyPath = modifyPath.replace(' /modify', '')
                resolve(modifyPath)
              } else {
                reject(new Error(`cached bundle not found:` + uninstallRegPath))
              }
            } else {
              reject(new Error(`Keybase entry not found at` + uninstallRegPath))
            }
          })
        } else {
          reject(new Error(`BUNDLEKEY not found at` + keybaseRegPath))
        }
      })
    } catch (err) {
      console.log('findKeybaseUninstallString caught', err)
    }
  })
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
function installCachedDokan(): Promise<*> {
  return findKeybaseUninstallString().then(
    modifyCommand =>
      new Promise((resolve, reject) => {
        if (modifyCommand) {
          console.log('Invoking repair to add driver: ' + modifyCommand)
          execFile(modifyCommand, [
            '/modify',
            'driver=1',
            'modifyprompt=Press "Repair" to view files in Explorer',
          ])
          resolve()
        } else {
          const err = new Error('Cannot find Keybase uninstall string')
          console.log(err)
          reject(err)
        }
      })
  )
}

function installDokanSaga() {
  return Saga.call(installCachedDokan)
}

function waitForMount(attempt: number): Promise<*> {
  return new Promise((resolve, reject) => {
    // Read the KBFS path waiting for files to exist, which means it's mounted
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

function openDefaultPath(): Promise<*> {
  return openInDefault(Constants.defaultKBFSPath)
}

// Wait for /keybase to exist with files in it and then opens in Finder
function waitForMountAndOpen(): Promise<*> {
  return waitForMount(0).then(openDefaultPath)
}

function* waitForMountAndOpenSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.put(KBFSGen.createOpenDefaultPath({opening: true}))
  try {
    yield Saga.call(waitForMountAndOpen)
  } finally {
    yield Saga.put(KBFSGen.createOpenDefaultPath({opening: false}))
  }
}

function* installKBFSSaga(): Saga.SagaGenerator<any, any> {
  const result: RPCTypes.InstallResult = yield Saga.call(RPCTypes.installInstallKBFSRpcPromise)
  yield Saga.put(KBFSGen.createInstallKBFSResult({result}))
  yield Saga.put(KBFSGen.createOpenDefaultPath({opening: true}))
  yield Saga.put(KBFSGen.createInstallKBFSFinished())
  yield Saga.call(waitForMountAndOpenSaga)
}

function uninstallKBFSSaga() {
  return Saga.call(RPCTypes.installUninstallKBFSRpcPromise)
}

function uninstallKBFSSagaSuccess(result: RPCTypes.UninstallResult) {
  // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
  const app = electron.remote.app
  app.relaunch()
  app.exit(0)
  return Saga.put(KBFSGen.createUninstallKBFSResult({result}))
}

function* openInWindows(openPath: string): Saga.SagaGenerator<any, any> {
  if (!openPath.startsWith(Constants.defaultKBFSPath)) {
    throw new Error(`openInWindows requires ${Constants.defaultKBFSPath} prefix: ${openPath}`)
  }
  openPath = openPath.slice(Constants.defaultKBFSPath.length)

  const state: TypedState = yield Saga.select()
  let kbfsPath = state.config.kbfsPath

  if (!kbfsPath) {
    throw new Error('No kbfsPath')
  }

  // On windows the path isn't /keybase
  if (kbfsPath === Constants.defaultKBFSPath) {
    // Get current mount
    kbfsPath = yield Saga.call(RPCTypes.kbfsMountGetCurrentMountDirRpcPromise)

    if (!kbfsPath) {
      throw new Error('No kbfsPath (RPC)')
    }

    yield Saga.put(ConfigGen.createChangeKBFSPath({kbfsPath}))
  }

  openPath = path.resolve(kbfsPath, openPath)
  // Check to make sure our resolved path starts with the kbfsPath
  // i.e. (not opening a folder outside kbfs)
  if (!openPath.startsWith(kbfsPath)) {
    throw new Error(`openInWindows requires ${kbfsPath} prefix: ${openPath}`)
  }

  yield Saga.call(_open, openPath)
}

function* openSaga(action: KBFSGen.OpenPayload): Saga.SagaGenerator<any, any> {
  const openPath = action.payload.path || Constants.defaultKBFSPath
  const state: TypedState = yield Saga.select()
  const enabled = state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted

  if (isLinux || enabled) {
    console.log('openInKBFS:', openPath)
    if (isWindows) {
      yield* openInWindows(openPath)
    } else {
      yield Saga.call(openInDefault, openPath)
    }
  } else {
    yield Saga.put(navigateTo([], [folderTab]))
    yield Saga.put(switchTo([folderTab]))
  }
}

function openInFileUISaga({payload: {path}}: KBFSGen.OpenInFileUIPayload, state: TypedState) {
  const enabled = state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted
  if (isLinux || enabled) {
    return Saga.call(_open, path)
  } else {
    return Saga.all([Saga.put(navigateTo([], [folderTab])), Saga.put(switchTo([folderTab]))])
  }
}

function* kbfsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(KBFSGen.open, openSaga)
  yield Saga.safeTakeEveryPure(KBFSGen.openInFileUI, openInFileUISaga)
  yield Saga.safeTakeLatest(KBFSGen.fuseStatus, fuseStatusSaga)
  yield Saga.safeTakeLatestPure(KBFSGen.fuseStatusUpdate, fuseStatusUpdateSaga)
  if (isWindows) {
    yield Saga.safeTakeLatestPure(KBFSGen.installFuse, installDokanSaga)
  } else {
    yield Saga.safeTakeLatest(KBFSGen.installFuse, installFuseSaga)
  }
  yield Saga.safeTakeLatest(KBFSGen.installKBFS, installKBFSSaga)
  yield Saga.safeTakeLatestPure(KBFSGen.uninstallKBFS, uninstallKBFSSaga, uninstallKBFSSagaSuccess)
}

export default kbfsSaga
