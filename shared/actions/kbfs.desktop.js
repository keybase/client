// @flow
import logger from '../logger'
import * as ConfigGen from './config-gen'
import * as KBFSGen from './kbfs-gen'
import * as FsGen from './fs-gen'
import * as Constants from '../constants/config'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as SafeElectron from '../util/safe-electron.desktop'
import fs from 'fs'
import path from 'path'
import {delay} from 'redux-saga'
import {spawn, execFileSync} from 'child_process'
import {folderTab} from '../constants/tabs'
import {isLinux, isWindows} from '../constants/platform'
import {navigateTo, switchTo} from './route-tree'
import type {TypedState} from '../constants/reducer'

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

function openInDefaultDirectory(openPath: string): Promise<void> {
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

      SafeElectron.getShell().openExternal(url, {activate: true}, err => {
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

function _open(openPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    isDirectory(openPath).then(isDir => {
      if (isDir && isWindows) {
        if (!SafeElectron.getShell().openItem(openPath)) {
          reject(new Error(`Unable to open item: ${openPath}`))
        }
      } else if (isDir) {
        openInDefaultDirectory(openPath).then(resolve, reject)
      } else {
        if (!SafeElectron.getShell().showItemInFolder(openPath)) {
          reject(new Error(`Unable to open item in folder: ${openPath}`))
        }
        resolve()
      }
    })
  })
}

function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const prevStatus = state.fs.fuseStatus

  let status = yield Saga.call(RPCTypes.installFuseStatusRpcPromise, {bundleVersion: ''})
  if (isWindows && status.installStatus !== 4) {
    // Check if another Dokan we didn't install mounted the filesystem
    const kbfsMount = yield Saga.call(RPCTypes.kbfsMountGetCurrentMountDirRpcPromise)
    if (kbfsMount && fs.existsSync(kbfsMount)) {
      status.installStatus = 4 // installed
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

// Copied from old constants/favorite.js:
//
// See Installer.m: KBExitFuseKextPermissionError
const ExitCodeFuseKextPermissionError = 5

function* installFuseSaga(): Saga.SagaGenerator<any, any> {
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

  yield Saga.put(KBFSGen.createInstallFuseResult({kextPermissionError}))
  yield Saga.put(KBFSGen.createFuseStatus())
  yield Saga.put(KBFSGen.createInstallFuseFinished())
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
function installCachedDokan(): Promise<void> {
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
    // restart the service, particularly kbfsdokan
    // based on desktop/app/start-win-service.js
    const binPath = path.resolve(String(process.env.LOCALAPPDATA), 'Keybase', 'keybase.exe')
    if (!binPath) {
      return
    }
    const rqPath = binPath.replace('keybase.exe', 'keybaserq.exe')
    const args = [binPath, 'ctl', 'restart']
    spawn(rqPath, args, {
      detached: true,
      stdio: 'ignore',
    })

    resolve()
  })
}

function installDokanSaga() {
  return Saga.call(installCachedDokan)
}

function waitForMount(attempt: number): Promise<boolean> {
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

function* waitForMountAndOpenSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.put(KBFSGen.createOpenDefaultPath({opening: true}))
  try {
    yield Saga.call(waitForMount, 0)
    yield* openWithCurrentMountDir(Constants.defaultKBFSPath)
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
  SafeElectron.getApp().relaunch()
  SafeElectron.getApp().exit(0)
  return Saga.put(KBFSGen.createUninstallKBFSResult({result}))
}

function* openWithCurrentMountDir(openPath: string): Saga.SagaGenerator<any, any> {
  const goodPath = path.posix.normalize(openPath)
  if (!openPath.startsWith(Constants.defaultKBFSPath)) {
    throw new Error(`openWithCurrentMountDir requires ${Constants.defaultKBFSPath} prefix: ${openPath}`)
  }

  // turns '/keybase/private/alice' to 'private/alice'
  const subPath = goodPath
    .split('/')
    .slice(2)
    .join(path.sep)

  const kbfsPath = yield Saga.call(RPCTypes.kbfsMountGetCurrentMountDirRpcPromise)

  if (!kbfsPath) {
    throw new Error('No kbfsPath (RPC)')
  }

  const resolvedPath = path.resolve(kbfsPath, subPath)
  // Check to make sure our resolved path starts with the kbfsPath
  // i.e. (not opening a folder outside kbfs)
  if (!resolvedPath.startsWith(kbfsPath)) {
    throw new Error(`openWithCurrentMountDir requires ${kbfsPath} prefix: ${goodPath}`)
  }

  yield Saga.call(_open, resolvedPath)
}

function* openSaga(action: KBFSGen.OpenPayload): Saga.SagaGenerator<any, any> {
  const openPath = action.payload.path || Constants.defaultKBFSPath
  const state: TypedState = yield Saga.select()
  const enabled = state.fs.fuseStatus && state.fs.fuseStatus.kextStarted

  if (isLinux || enabled) {
    logger.info('openInKBFS:', openPath)
    yield* openWithCurrentMountDir(openPath)
  } else {
    yield Saga.put(navigateTo([], [folderTab]))
    yield Saga.put(switchTo([folderTab]))
  }
}

function openInFileUISaga({payload: {path}}: KBFSGen.OpenInFileUIPayload, state: TypedState) {
  const enabled = state.fs.fuseStatus && state.fs.fuseStatus.kextStarted
  if (isLinux || enabled) {
    return Saga.call(_open, path)
  } else {
    return Saga.sequentially([Saga.put(navigateTo([], [folderTab])), Saga.put(switchTo([folderTab]))])
  }
}

function* waitForKBFS(action: ConfigGen.DaemonHandshakePayload) {
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      increment: true,
      name: 'kbfs.waitingForDaemon',
      version: action.payload.version,
    })
  )
  const connected = yield Saga.call(RPCTypes.configWaitForClientRpcPromise, {
    clientType: RPCTypes.commonClientType.kbfs,
    timeout: 10.0,
  })
  yield Saga.put(KBFSGen.createFuseStatus())
  yield Saga.put(FsGen.createFuseStatus())
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      failedReason: connected ? null : Constants.noKBFSFailReason,
      increment: false,
      name: 'kbfs.waitingForDaemon',
      version: action.payload.version,
    })
  )
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
  yield Saga.safeTakeEveryPure(ConfigGen.daemonHandshake, waitForKBFS)
}

export default kbfsSaga
