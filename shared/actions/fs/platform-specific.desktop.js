// @flow
import * as I from 'immutable'
import * as ConfigGen from '../config-gen'
import * as FsGen from '../fs-gen'
import * as Saga from '../../util/saga'
import * as Config from '../../constants/config'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Tabs from '../../constants/tabs'
import fs from 'fs'
import type {TypedState} from '../../constants/reducer'
import {fileUIName, isLinux, isWindows} from '../../constants/platform'
import logger from '../../logger'
import {spawn, execFileSync, exec} from 'child_process'
import path from 'path'
import {makeRetriableErrorHandler, makeUnretriableErrorHandler} from './shared'
import {navigateTo, switchTo} from '../route-tree'

type pathType = 'file' | 'directory'

// pathToURL takes path and converts to (file://) url.
// See https://github.com/sindresorhus/file-url
function pathToURL(p: string): string {
  let goodPath = p.replace(/\\/g, '/')

  // Windows drive letter must be prefixed with a slash
  if (goodPath[0] !== '/') {
    goodPath = '/' + goodPath
  }

  return encodeURI('file://' + goodPath).replace(/#/g, '%23')
}

function openInDefaultDirectory(openPath: string) {
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

// _openPathInSystemFileManagerPromise opens `openPath` in system file manager.
// If isFolder is true, it just opens it. Otherwise, it shows it in its parent
// folder. This function does not check if the file exists, or try to convert
// KBFS paths. Caller should take care of those.
const _openPathInSystemFileManagerPromise = (openPath: string, isFolder: boolean) =>
  new Promise((resolve, reject) =>
    isFolder
      ? isWindows
        ? SafeElectron.getShell().openItem(openPath)
          ? resolve()
          : reject(new Error('unable to open item'))
        : openInDefaultDirectory(openPath).then(resolve, reject)
      : SafeElectron.getShell().showItemInFolder(openPath)
      ? resolve()
      : reject(new Error('unable to open item in folder'))
  )

const openLocalPathInSystemFileManager = (
  state: TypedState,
  action: FsGen.OpenLocalPathInSystemFileManagerPayload
) =>
  getPathType(action.payload.path)
    .then(pathType => _openPathInSystemFileManagerPromise(action.payload.path, pathType === 'directory'))
    .catch(makeUnretriableErrorHandler(action))

const _rebaseKbfsPathToMountLocation = (kbfsPath: Types.Path, mountLocation: string) =>
  path.resolve(
    mountLocation,
    Types.getPathElements(kbfsPath)
      .slice(1)
      .join(path.sep)
  )

const openPathInSystemFileManager = (state: TypedState, action: FsGen.OpenPathInSystemFileManagerPayload) =>
  isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
    ? RPCTypes.kbfsMountGetCurrentMountDirRpcPromise()
        .then(mountLocation =>
          _openPathInSystemFileManagerPromise(
            _rebaseKbfsPathToMountLocation(action.payload.path, mountLocation),
            state.fs.pathItems.get(action.payload.path, Constants.unknownPathItem).type === 'folder'
          )
        )
        .catch(err => {
          return makeRetriableErrorHandler(action)(err)
        })
    : new Promise((resolve, reject) =>
        // This usually indicates a developer error as
        // openPathInSystemFileManager shouldn't be used when FUSE integration
        // is not enabled. So just blackbar to encourage a log send.
        reject(new Error('FUSE integration is not enabled'))
      )

function waitForMount(attempt: number) {
  return new Promise((resolve, reject) => {
    // Read the KBFS path waiting for files to exist, which means it's mounted
    // TODO: should handle current mount directory
    fs.readdir(`${Config.defaultKBFSPath}${Config.defaultPrivatePrefix}`, (err, files) => {
      if (!err && files.length > 0) {
        resolve(true)
      } else if (attempt > 15) {
        reject(new Error(`${Config.defaultKBFSPath} is unavailable. Please try again.`))
      } else {
        setTimeout(() => {
          waitForMount(attempt + 1).then(resolve, reject)
        }, 1000)
      }
    })
  })
}

const installKBFS = () =>
  RPCTypes.installInstallKBFSRpcPromise()
    .then(() => waitForMount(0))
    .then(() => FsGen.createSetFlags({kbfsInstalling: false, showBanner: true}))

function fuseStatusResultSaga({payload: {prevStatus, status}}: FsGen.FuseStatusResultPayload) {
  // If our kextStarted status changed, finish KBFS install
  if (status.kextStarted && prevStatus && !prevStatus.kextStarted) {
    return Saga.put(FsGen.createInstallKBFS())
  }
}

function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const prevStatus = state.fs.fuseStatus

  let status = yield Saga.call(RPCTypes.installFuseStatusRpcPromise, {bundleVersion: ''})
  if (isWindows && status.installStatus !== RPCTypes.installInstallStatus.installed) {
    // Check if another Dokan we didn't install mounted the filesystem
    const kbfsMount = yield Saga.call(RPCTypes.kbfsMountGetCurrentMountDirRpcPromise)
    if (kbfsMount && fs.existsSync(kbfsMount)) {
      status.installStatus = RPCTypes.installInstallStatus.installed
      status.installAction = RPCTypes.installInstallAction.none
      status.kextStarted = true
    }
  }
  yield Saga.put(FsGen.createFuseStatusResult({prevStatus, status}))
}

function* installFuseSaga(): Saga.SagaGenerator<any, any> {
  const result: RPCTypes.InstallResult = yield Saga.call(RPCTypes.installInstallFuseRpcPromise)
  const fuseResults =
    result && result.componentResults ? result.componentResults.filter(c => c.name === 'fuse') : []
  const kextPermissionError =
    fuseResults.length > 0 && fuseResults[0].exitCode === Constants.ExitCodeFuseKextPermissionError

  if (kextPermissionError) {
    // Add a small delay here, since on 10.13 the OS will be a little laggy
    // when showing a kext permission error.
    yield Saga.delay(1e3)
  }

  yield Saga.put(FsGen.createInstallFuseResult({kextPermissionError}))
  yield Saga.put(FsGen.createFuseStatus())
  yield Saga.put(FsGen.createSetFlags({fuseInstalling: false}))
  // TODO: do something like uninstallConfirmSaga here
}

const uninstallKBFSConfirm = (action: FsGen.UninstallKBFSConfirmPayload) =>
  new Promise((resolve, reject) =>
    SafeElectron.getDialog().showMessageBox(
      null,
      {
        buttons: ['Remove & Restart', 'Cancel'],
        detail: `Are you sure you want to remove Keybase from ${fileUIName} and restart the app?`,
        message: `Remove Keybase from ${fileUIName}`,
        type: 'question',
      },
      resp => resolve(resp)
    )
  )

const uninstallKBFSConfirmSuccess = resp =>
  resp
    ? undefined
    : Saga.sequentially([
        Saga.call(RPCTypes.installUninstallKBFSRpcPromise),
        Saga.call(() => {
          // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
          SafeElectron.getApp().relaunch()
          SafeElectron.getApp().exit(0)
        }),
      ])

const openSecurityPreferences = () =>
  Saga.call(
    () =>
      new Promise((resolve, reject) => {
        SafeElectron.getShell().openExternal(
          'x-apple.systempreferences:com.apple.preference.security?General',
          {activate: true},
          err => {
            if (err) {
              reject(err)
              return
            }
            logger.info('Opened Security Preferences')
            resolve()
          }
        )
      })
  )

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
function installCachedDokan() {
  return new Promise((resolve, reject) => {
    logger.info('Invoking dokan installer')
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

const uninstallDokanPromise = (state: TypedState) => {
  const uninstallString = Constants.kbfsUninstallString(state)
  if (!uninstallString) {
    return
  }
  logger.info('Invoking dokan uninstaller')
  return new Promise(resolve => {
    try {
      exec(uninstallString, {windowsHide: true}, resolve)
    } catch (e) {
      logger.error('uninstallDokan caught', e)
      resolve()
    }
  }).then(() => FsGen.createFuseStatus())
}

const openAndUploadToPromise = (state: TypedState, action: FsGen.OpenAndUploadPayload) =>
  new Promise((resolve, reject) =>
    SafeElectron.getDialog().showOpenDialog(
      SafeElectron.getCurrentWindowFromRemote(),
      {
        properties: [
          'multiSelections',
          ...(['file', 'both'].includes(action.payload.type) ? ['openFile'] : []),
          ...(['directory', 'both'].includes(action.payload.type) ? ['openDirectory'] : []),
        ],
        title: 'Select a file or folder to upload',
      },
      filePaths => resolve(filePaths || [])
    )
  )

const openAndUpload = (state: TypedState, action: FsGen.OpenAndUploadPayload) =>
  Saga.call(function*() {
    const localPaths = yield Saga.call(openAndUploadToPromise, state, action)
    yield Saga.all(
      localPaths.map(localPath =>
        Saga.put(FsGen.createUpload({localPath, parentPath: action.payload.parentPath}))
      )
    )
  })

const loadUserFileEdits = (state: TypedState, action) =>
  Saga.call(function*() {
    try {
      const writerEdits = yield Saga.call(RPCTypes.SimpleFSSimpleFSUserEditHistoryRpcPromise)
      const tlfUpdates = Constants.userTlfHistoryRPCToState(writerEdits || [])
      const updateSet = tlfUpdates
        .reduce(
          (acc: I.Set<Types.Path>, u) =>
            Types.getPathElements(u.path).reduce((acc, e, i, a) => {
              if (i < 2) return acc
              const path = Types.getPathFromElements(a.slice(0, i + 1))
              return acc.add(path)
            }, acc),
          I.Set()
        )
        .toArray()
      yield Saga.sequentially([
        // TODO (songgao): make a new action that accepts an array of updates,
        // so that we only need to trigger one update through store/rpc/widget
        // for all these each time.
        ...updateSet.map(path =>
          Saga.put(
            FsGen.createFilePreviewLoad({
              identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
              path,
            })
          )
        ),
        Saga.put(FsGen.createUserFileEditsLoaded({tlfUpdates})),
      ])
    } catch (ex) {
      yield makeRetriableErrorHandler(action)
    }
  })

const openFilesFromWidget = (state: TypedState, {payload: {path, type}}: FsGen.OpenFilesFromWidgetPayload) =>
  Saga.sequentially([
    Saga.put(ConfigGen.createShowMain()),
    ...(path
      ? [
          Saga.put(
            navigateTo([
              Tabs.fsTab,
              {
                props: {path: Types.getPathParent(path)},
                selected: 'folder',
              },
              {
                props: {path},
                selected: type === 'folder' ? 'folder' : 'preview',
              },
            ])
          ),
        ]
      : [Saga.put(switchTo([Tabs.fsTab]))]),
  ])

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(FsGen.openLocalPathInSystemFileManager, openLocalPathInSystemFileManager)
  yield Saga.actionToPromise(FsGen.openPathInSystemFileManager, openPathInSystemFileManager)
  yield Saga.safeTakeEvery([ConfigGen.setupEngineListeners, FsGen.fuseStatus], fuseStatusSaga)
  yield Saga.safeTakeEveryPure(FsGen.fuseStatusResult, fuseStatusResultSaga)
  yield Saga.actionToPromise(FsGen.installKBFS, installKBFS)
  yield Saga.actionToAction(FsGen.openAndUpload, openAndUpload)
  yield Saga.actionToAction(FsGen.userFileEditsLoad, loadUserFileEdits)
  yield Saga.actionToAction(FsGen.openFilesFromWidget, openFilesFromWidget)
  if (isWindows) {
    yield Saga.safeTakeEveryPure(FsGen.installFuse, installDokanSaga)
    yield Saga.actionToPromise(FsGen.uninstallKBFSConfirm, uninstallDokanPromise)
  } else {
    yield Saga.safeTakeEvery(FsGen.installFuse, installFuseSaga)
    yield Saga.safeTakeEveryPure(
      FsGen.uninstallKBFSConfirm,
      uninstallKBFSConfirm,
      uninstallKBFSConfirmSuccess
    )
  }
  yield Saga.safeTakeEveryPure(FsGen.openSecurityPreferences, openSecurityPreferences)
}

export default platformSpecificSaga
