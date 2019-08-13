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
import {TypedState, TypedActions} from '../../util/container'
import {fileUIName, isWindows, isLinux} from '../../constants/platform'
import logger from '../../logger'
import {spawn, execFile, exec} from 'child_process'
import path from 'path'
import {makeRetriableErrorHandler, makeUnretriableErrorHandler} from './shared'
import * as RouteTreeGen from '../route-tree-gen'

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

      SafeElectron.getShell()
        .openExternal(url, {activate: true})
        .then(() => {
          logger.info('Opened directory:', openPath)
          resolve()
        })
        .catch(err => {
          reject(err)
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
const _openPathInSystemFileManagerPromise = (openPath: string, isFolder: boolean): Promise<void> =>
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
  _: TypedState,
  action: FsGen.OpenLocalPathInSystemFileManagerPayload
) =>
  getPathType(action.payload.localPath)
    .then(pathType => _openPathInSystemFileManagerPromise(action.payload.localPath, pathType === 'directory'))
    .catch(makeUnretriableErrorHandler(action, null))

const _rebaseKbfsPathToMountLocation = (kbfsPath: Types.Path, mountLocation: string) =>
  path.resolve(
    mountLocation,
    Types.getPathElements(kbfsPath)
      .slice(1)
      .join(path.sep)
  )

const openPathInSystemFileManager = (state: TypedState, action: FsGen.OpenPathInSystemFileManagerPayload) =>
  state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Enabled
    ? RPCTypes.kbfsMountGetCurrentMountDirRpcPromise()
        .then(mountLocation =>
          _openPathInSystemFileManagerPromise(
            _rebaseKbfsPathToMountLocation(action.payload.path, mountLocation),
            ![Types.PathKind.InGroupTlf, Types.PathKind.InTeamTlf].includes(
              Constants.parsePath(action.payload.path).kind
            ) ||
              state.fs.pathItems.get(action.payload.path, Constants.unknownPathItem).type ===
                Types.PathType.Folder
          )
        )
        .catch(makeRetriableErrorHandler(action, action.payload.path))
    : (new Promise((_, reject) =>
        // This usually indicates a developer error as
        // openPathInSystemFileManager shouldn't be used when FUSE integration
        // is not enabled. So just blackbar to encourage a log send.
        reject(new Error('FUSE integration is not enabled'))
      ) as Promise<void>)

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

const fuseStatusToUninstallExecPath = isWindows
  ? (status: RPCTypes.FuseStatus) => {
      const field =
        status &&
        status.status &&
        status.status.fields &&
        status.status.fields.find(({key}) => key === 'uninstallString')
      return field && field.value
    }
  : (_: RPCTypes.FuseStatus | null) => null

const fuseStatusToActions = (previousStatusType: Types.DriverStatusType) => (
  status: RPCTypes.FuseStatus | null
) => {
  if (!status) {
    return FsGen.createSetDriverStatus({driverStatus: Constants.defaultDriverStatus})
  }
  return status.kextStarted
    ? [
        FsGen.createSetDriverStatus({
          driverStatus: Constants.makeDriverStatusEnabled({
            dokanOutdated: status.installAction === RPCTypes.InstallAction.upgrade,
            dokanUninstallExecPath: fuseStatusToUninstallExecPath(status),
          }),
        }),
        ...(previousStatusType === Types.DriverStatusType.Disabled ||
        status.installAction === RPCTypes.InstallAction.upgrade
          ? [FsGen.createShowSystemFileManagerIntegrationBanner()]
          : []), // show banner for newly enabled
        ...(previousStatusType === Types.DriverStatusType.Disabled
          ? [FsGen.createOpenPathInSystemFileManager({path: Types.stringToPath('/keybase')})]
          : []), // open Finder/Explorer/etc for newly enabled
      ]
    : [
        FsGen.createSetDriverStatus({driverStatus: Constants.makeDriverStatusDisabled()}),
        ...(previousStatusType === Types.DriverStatusType.Enabled
          ? [FsGen.createHideSystemFileManagerIntegrationBanner()]
          : []), // hide banner for newly disabled
        ...(previousStatusType === Types.DriverStatusType.Unknown
          ? [FsGen.createShowSystemFileManagerIntegrationBanner()]
          : []), // show banner for disabled on first load
      ]
}

const windowsCheckMountFromOtherDokanInstall = status =>
  RPCTypes.kbfsMountGetCurrentMountDirRpcPromise().then(mountPoint =>
    mountPoint
      ? new Promise(resolve => fs.access(mountPoint, fs.constants.F_OK, err => resolve(!err))).then(
          mountExists =>
            mountExists
              ? {
                  ...status,
                  installAction: RPCTypes.InstallAction.none,
                  installStatus: RPCTypes.InstallStatus.installed,
                  kextStarted: true,
                }
              : status
        )
      : status
  )

const refreshDriverStatus = (
  state: TypedState,
  action: FsGen.KbfsDaemonRpcStatusChangedPayload | FsGen.RefreshDriverStatusPayload
) =>
  (action.type !== FsGen.kbfsDaemonRpcStatusChanged ||
    action.payload.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) &&
  RPCTypes.installFuseStatusRpcPromise({bundleVersion: ''})
    .then(status =>
      isWindows && status.installStatus !== RPCTypes.InstallStatus.installed
        ? windowsCheckMountFromOtherDokanInstall(status)
        : Promise.resolve(status)
    )
    .then(fuseStatusToActions(state.fs.sfmi.driverStatus.type))

const fuseInstallResultIsKextPermissionError = (result: RPCTypes.InstallResult): boolean =>
  !!result &&
  !!result.componentResults &&
  result.componentResults.findIndex(
    c => c.name === 'fuse' && c.exitCode === Constants.ExitCodeFuseKextPermissionError
  ) !== -1

const driverEnableFuse = async (_: TypedState, action: FsGen.DriverEnablePayload) => {
  const result = await RPCTypes.installInstallFuseRpcPromise()
  if (fuseInstallResultIsKextPermissionError(result)) {
    return [
      FsGen.createDriverKextPermissionError(),
      ...(action.payload.isRetry ? [] : [RouteTreeGen.createNavigateAppend({path: ['kextPermission']})]),
    ]
  } else {
    await RPCTypes.installInstallKBFSRpcPromise() // restarts kbfsfuse
    await waitForMount(0)
    return FsGen.createRefreshDriverStatus()
  }
}

const uninstallKBFSConfirm = async () => {
  const action = await new Promise<TypedActions | false>(resolve =>
    SafeElectron.getDialog().showMessageBox(
      {
        buttons: ['Remove & Restart', 'Cancel'],
        detail: `Are you sure you want to remove Keybase from ${fileUIName} and restart the app?`,
        message: `Remove Keybase from ${fileUIName}`,
        type: 'question',
      },
      // resp is the index of the button that's clicked
      resp => (resp === 0 ? resolve(FsGen.createDriverDisabling()) : resolve(false))
    )
  )
  return action
}

const uninstallKBFS = () =>
  RPCTypes.installUninstallKBFSRpcPromise().then(() => {
    // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
    SafeElectron.getApp().relaunch()
    SafeElectron.getApp().exit(0)
  })

const uninstallDokanConfirm = async (state: TypedState) => {
  if (state.fs.sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) {
    return false
  }
  if (!state.fs.sfmi.driverStatus.dokanUninstallExecPath) {
    const action = await new Promise<TypedActions>(resolve =>
      SafeElectron.getDialog().showMessageBox(
        {
          buttons: ['Got it'],
          detail:
            'We looked everywhere but did not find a Dokan uninstaller. Please remove it from the Control Panel.',
          message: 'Please uninstall Dokan from the Control Panel.',
          type: 'info',
        },
        () => resolve(FsGen.createRefreshDriverStatus())
      )
    )
    return action
  }
  return FsGen.createDriverDisabling()
}

const uninstallDokan = (state: TypedState) => {
  if (state.fs.sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) return
  const execPath: string = state.fs.sfmi.driverStatus.dokanUninstallExecPath || ''
  logger.info('Invoking dokan uninstaller', execPath)
  return new Promise(resolve => {
    try {
      exec(execPath, {windowsHide: true}, resolve)
    } catch (e) {
      logger.error('uninstallDokan caught', e)
      resolve()
    }
  }).then(() => FsGen.createRefreshDriverStatus())
}

const openSecurityPreferences = () => {
  SafeElectron.getShell()
    .openExternal('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
    .then(() => {
      logger.info('Opened Security Preferences')
    })
    .catch(() => {})
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
const installCachedDokan = (_: TypedState, action: FsGen.DriverEnablePayload) =>
  new Promise((resolve, reject) => {
    logger.info('Invoking dokan installer')
    const dokanPath = path.resolve(String(process.env.LOCALAPPDATA), 'Keybase', 'DokanSetup_redist.exe')
    execFile(dokanPath, [], err => {
      if (err) {
        reject(err)
        return
      }
      // restart the service, particularly kbfsdokan
      // based on desktop/app/start-win-service.js
      const binPath = path.resolve(String(process.env.LOCALAPPDATA), 'Keybase', 'keybase.exe')
      if (!binPath) {
        reject(new Error('resolve failed'))
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
  })
    .then(() => FsGen.createRefreshDriverStatus())
    .catch(makeUnretriableErrorHandler(action, null))

const openAndUploadToPromise = (_: TypedState, action: FsGen.OpenAndUploadPayload): Promise<Array<string>> =>
  new Promise(resolve =>
    SafeElectron.getDialog().showOpenDialog(
      SafeElectron.getCurrentWindowFromRemote(),
      {
        // @ts-ignore codemod-issue
        properties: [
          'multiSelections',
          ...(['file', 'both'].includes(action.payload.type) ? ['openFile'] : []),
          ...(['directory', 'both'].includes(action.payload.type) ? ['openDirectory'] : []),
        ],
        title: 'Select a file or folder to upload',
      },
      (filePaths: Array<string>) => resolve(filePaths || [])
    )
  )

const openAndUpload = (state: TypedState, action: FsGen.OpenAndUploadPayload) =>
  openAndUploadToPromise(state, action).then((localPaths: Array<string>) =>
    localPaths.map(localPath => FsGen.createUpload({localPath, parentPath: action.payload.parentPath}))
  )

const loadUserFileEdits = state =>
  state.fs.kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected &&
  RPCTypes.SimpleFSSimpleFSUserEditHistoryRpcPromise().then(writerEdits =>
    FsGen.createUserFileEditsLoaded({
      tlfUpdates: Constants.userTlfHistoryRPCToState(writerEdits || []),
    })
  )

const openFilesFromWidget = (_: TypedState, {payload: {path}}) => [
  ConfigGen.createShowMain(),
  ...(path
    ? [Constants.makeActionForOpenPathInFilesTab(path)]
    : [RouteTreeGen.createNavigateAppend({path: [Tabs.fsTab]})]),
]

const changedFocus = (state: TypedState, action: ConfigGen.ChangedFocusPayload) =>
  action.payload.appFocused &&
  state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Disabled &&
  state.fs.sfmi.driverStatus.kextPermissionError &&
  FsGen.createDriverEnable({isRetry: true})

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(FsGen.openLocalPathInSystemFileManager, openLocalPathInSystemFileManager)
  yield* Saga.chainAction2(FsGen.openPathInSystemFileManager, openPathInSystemFileManager)
  if (!isLinux) {
    yield* Saga.chainAction2(
      [FsGen.kbfsDaemonRpcStatusChanged, FsGen.refreshDriverStatus],
      refreshDriverStatus
    )
  }
  yield* Saga.chainAction2(FsGen.openAndUpload, openAndUpload)
  yield* Saga.chainAction2([FsGen.userFileEditsLoad, FsGen.kbfsDaemonRpcStatusChanged], loadUserFileEdits)
  yield* Saga.chainAction2(FsGen.openFilesFromWidget, openFilesFromWidget)
  if (isWindows) {
    yield* Saga.chainAction2(FsGen.driverEnable, installCachedDokan)
    yield* Saga.chainAction2(FsGen.driverDisable, uninstallDokanConfirm)
    yield* Saga.chainAction2(FsGen.driverDisabling, uninstallDokan)
  } else {
    yield* Saga.chainAction2(FsGen.driverEnable, driverEnableFuse)
    yield* Saga.chainAction2(FsGen.driverDisable, uninstallKBFSConfirm)
    yield* Saga.chainAction2(FsGen.driverDisabling, uninstallKBFS)
  }
  yield* Saga.chainAction2(FsGen.openSecurityPreferences, openSecurityPreferences)
  yield* Saga.chainAction2(FsGen.openSecurityPreferences, openSecurityPreferences)
  yield* Saga.chainAction2(ConfigGen.changedFocus, changedFocus)
}

export default platformSpecificSaga
