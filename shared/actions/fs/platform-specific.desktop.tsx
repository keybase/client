import * as ConfigGen from '../config-gen'
import * as FsGen from '../fs-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Electron from 'electron'
import * as Tabs from '../../constants/tabs'
import fs from 'fs'
import {TypedState, TypedActions} from '../../util/container'
import {fileUIName, isWindows, isLinux} from '../../constants/platform'
import logger from '../../logger'
import {spawn, execFile, exec} from 'child_process'
import {errorToActionOrThrow} from './shared'
import * as RouteTreeGen from '../route-tree-gen'

const {path} = KB
const {sep} = path
const {env} = KB.process

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

const openInDefaultDirectory = (openPath: string): Promise<void> => {
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

      Electron.remote.shell
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
  new Promise((resolve, reject) => {
    if (isFolder) {
      if (isWindows) {
        if (Electron.remote.shell.openItem(openPath)) {
          resolve()
        } else {
          reject(new Error('unable to open item'))
        }
      } else {
        openInDefaultDirectory(openPath).then(resolve, reject)
      }
    } else {
      Electron.remote.shell.showItemInFolder(openPath)
      resolve()
    }
  })

const openLocalPathInSystemFileManager = async (action: FsGen.OpenLocalPathInSystemFileManagerPayload) => {
  try {
    const pathType = await getPathType(action.payload.localPath)
    return _openPathInSystemFileManagerPromise(action.payload.localPath, pathType === 'directory')
  } catch (e) {
    return errorToActionOrThrow(e)
  }
}

const _rebaseKbfsPathToMountLocation = (kbfsPath: Types.Path, mountLocation: string) =>
  path.resolve(
    mountLocation,
    Types.getPathElements(kbfsPath)
      .slice(1)
      .join(sep)
  )

const openPathInSystemFileManager = (state: TypedState, action: FsGen.OpenPathInSystemFileManagerPayload) =>
  state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Enabled && state.fs.sfmi.directMountDir
    ? _openPathInSystemFileManagerPromise(
        _rebaseKbfsPathToMountLocation(action.payload.path, state.fs.sfmi.directMountDir),
        ![Types.PathKind.InGroupTlf, Types.PathKind.InTeamTlf].includes(
          Constants.parsePath(action.payload.path).kind
        ) || Constants.getPathItem(state.fs.pathItems, action.payload.path).type === Types.PathType.Folder
      ).catch(e => errorToActionOrThrow(action.payload.path, e))
    : (new Promise((resolve, reject) => {
        if (state.fs.sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) {
          // This usually indicates a developer error as
          // openPathInSystemFileManager shouldn't be used when FUSE integration
          // is not enabled. So just blackbar to encourage a log send.
          reject(new Error('FUSE integration is not enabled'))
        } else {
          logger.warn('empty directMountDir') // if this happens it might be a race?
          resolve()
        }
      }) as Promise<void>)

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
    return FsGen.createSetDriverStatus({
      driverStatus: Constants.defaultDriverStatus,
    })
  }
  return status.kextStarted
    ? [
        FsGen.createSetDriverStatus({
          driverStatus: {
            ...Constants.emptyDriverStatusEnabled,
            dokanOutdated: status.installAction === RPCTypes.InstallAction.upgrade,
            dokanUninstallExecPath: fuseStatusToUninstallExecPath(status),
          },
        }),
        ...(previousStatusType === Types.DriverStatusType.Disabled
          ? [
              FsGen.createOpenPathInSystemFileManager({
                path: Types.stringToPath('/keybase'),
              }),
            ]
          : []), // open Finder/Explorer/etc for newly enabled
      ]
    : [
        FsGen.createSetDriverStatus({
          driverStatus: Constants.emptyDriverStatusDisabled,
        }),
      ]
}

const windowsCheckMountFromOtherDokanInstall = (status: RPCTypes.FuseStatus) =>
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

const refreshDriverStatus = async (
  state: TypedState,
  action: FsGen.KbfsDaemonRpcStatusChangedPayload | FsGen.RefreshDriverStatusPayload
) => {
  if (
    action.type !== FsGen.kbfsDaemonRpcStatusChanged ||
    action.payload.rpcStatus === Types.KbfsDaemonRpcStatus.Connected
  ) {
    let status = await RPCTypes.installFuseStatusRpcPromise({
      bundleVersion: '',
    })
    if (isWindows && status.installStatus !== RPCTypes.InstallStatus.installed) {
      status = await windowsCheckMountFromOtherDokanInstall(status)
    }
    return fuseStatusToActions(state.fs.sfmi.driverStatus.type)(status)
  }
  return false
}

const fuseInstallResultIsKextPermissionError = (result: RPCTypes.InstallResult): boolean =>
  !!result &&
  !!result.componentResults &&
  result.componentResults.findIndex(
    c => c.name === 'fuse' && c.exitCode === Constants.ExitCodeFuseKextPermissionError
  ) !== -1

const driverEnableFuse = async (action: FsGen.DriverEnablePayload) => {
  const result = await RPCTypes.installInstallFuseRpcPromise()
  if (fuseInstallResultIsKextPermissionError(result)) {
    return [
      FsGen.createDriverKextPermissionError(),
      ...(action.payload.isRetry ? [] : [RouteTreeGen.createNavigateAppend({path: ['kextPermission']})]),
    ]
  } else {
    await RPCTypes.installInstallKBFSRpcPromise() // restarts kbfsfuse
    await RPCTypes.kbfsMountWaitForMountsRpcPromise()
    return FsGen.createRefreshDriverStatus()
  }
}

const uninstallKBFSConfirm = async () => {
  const action = await new Promise<TypedActions | false>(resolve =>
    Electron.remote.dialog
      .showMessageBox({
        buttons: ['Remove & Restart', 'Cancel'],
        detail: `Are you sure you want to remove Keybase from ${fileUIName} and restart the app?`,
        message: `Remove Keybase from ${fileUIName}`,
        type: 'question',
      })
      // resp is the index of the button that's clicked
      .then(({response}) => (response === 0 ? resolve(FsGen.createDriverDisabling()) : resolve(false)))
  )
  return action
}

const uninstallKBFS = () =>
  RPCTypes.installUninstallKBFSRpcPromise().then(() => {
    // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
    Electron.remote.app.relaunch()
    Electron.remote.app.exit(0)
  })

// @ts-ignore
const uninstallDokanConfirm = async (state: TypedState) => {
  if (state.fs.sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) {
    return false
  }
  if (!state.fs.sfmi.driverStatus.dokanUninstallExecPath) {
    const action = await new Promise<TypedActions>(resolve =>
      Electron.remote.dialog
        .showMessageBox({
          buttons: ['Got it'],
          detail:
            'We looked everywhere but did not find a Dokan uninstaller. Please remove it from the Control Panel.',
          message: 'Please uninstall Dokan from the Control Panel.',
          type: 'info',
        })
        .then(() => resolve(FsGen.createRefreshDriverStatus()))
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
  Electron.remote.shell
    .openExternal('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
    .then(() => {
      logger.info('Opened Security Preferences')
    })
    .catch(() => {})
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
const installCachedDokan = () =>
  new Promise((resolve, reject) => {
    logger.info('Invoking dokan installer')
    const dokanPath = path.resolve(String(env.LOCALAPPDATA), 'Keybase', 'DokanSetup_redist.exe')
    execFile(dokanPath, [], err => {
      if (err) {
        reject(err)
        return
      }
      // restart the service, particularly kbfsdokan
      // based on desktop/app/start-win-service.js
      const binPath = path.resolve(String(env.LOCALAPPDATA), 'Keybase', 'keybase.exe')
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
    .catch(e => errorToActionOrThrow(e))

const openAndUploadToPromise = (action: FsGen.OpenAndUploadPayload): Promise<Array<string>> =>
  Electron.remote.dialog
    .showOpenDialog(Electron.remote.getCurrentWindow(), {
      properties: [
        'multiSelections' as const,
        ...(['file', 'both'].includes(action.payload.type) ? (['openFile'] as const) : []),
        ...(['directory', 'both'].includes(action.payload.type) ? (['openDirectory'] as const) : []),
      ],
      title: 'Select a file or folder to upload',
    })
    .then(res => res.filePaths)

const openAndUpload = async (action: FsGen.OpenAndUploadPayload) => {
  const localPaths = await openAndUploadToPromise(action)
  return localPaths.map(localPath => FsGen.createUpload({localPath, parentPath: action.payload.parentPath}))
}

const loadUserFileEdits = async (_: TypedState) => {
  try {
    const writerEdits = await RPCTypes.SimpleFSSimpleFSUserEditHistoryRpcPromise()
    return FsGen.createUserFileEditsLoaded({
      tlfUpdates: Constants.userTlfHistoryRPCToState(writerEdits || []),
    })
  } catch (error) {
    return errorToActionOrThrow(error)
  }
}

const openFilesFromWidget = ({payload: {path}}: FsGen.OpenFilesFromWidgetPayload) => [
  ConfigGen.createShowMain(),
  ...(path
    ? [Constants.makeActionForOpenPathInFilesTab(path)]
    : ([RouteTreeGen.createNavigateAppend({path: [Tabs.fsTab]})] as any)),
]

const changedFocus = (state: TypedState, action: ConfigGen.ChangedFocusPayload) =>
  action.payload.appFocused &&
  state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Disabled &&
  state.fs.sfmi.driverStatus.kextPermissionError &&
  FsGen.createDriverEnable({isRetry: true})

const refreshMountDirs = async (
  state: TypedState,
  action:
    | FsGen.RefreshMountDirsAfter10sPayload
    | FsGen.KbfsDaemonRpcStatusChangedPayload
    | FsGen.SetDriverStatusPayload
) => {
  if (action.type === FsGen.refreshMountDirsAfter10s) {
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
  if (state.fs.sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) {
    return null
  }
  const directMountDir = await RPCTypes.kbfsMountGetCurrentMountDirRpcPromise()
  const preferredMountDirs = await RPCTypes.kbfsMountGetPreferredMountDirsRpcPromise()
  return [
    FsGen.createSetDirectMountDir({directMountDir}),
    FsGen.createSetPreferredMountDirs({
      preferredMountDirs: preferredMountDirs || [],
    }),
    // Check again in 10s, as redirector comes up only after kbfs daemon is alive.
    ...(action.type !== FsGen.refreshMountDirsAfter10s ? [FsGen.createRefreshMountDirsAfter10s()] : []),
  ]
}

export const ensureDownloadPermissionPromise = () => Promise.resolve()

const setSfmiBannerDismissed = (
  _: TypedState,
  action: FsGen.SetSfmiBannerDismissedPayload | FsGen.DriverEnablePayload | FsGen.DriverDisablePayload
) => {
  switch (action.type) {
    case FsGen.setSfmiBannerDismissed:
      return RPCTypes.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed: action.payload.dismissed})
    case FsGen.driverEnable:
    case FsGen.driverDisable:
      return RPCTypes.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed: false})
  }
}

function* platformSpecificSaga() {
  yield* Saga.chainAction(FsGen.openLocalPathInSystemFileManager, openLocalPathInSystemFileManager)
  yield* Saga.chainAction2(FsGen.openPathInSystemFileManager, openPathInSystemFileManager)
  if (!isLinux) {
    yield* Saga.chainAction2(
      [FsGen.kbfsDaemonRpcStatusChanged, FsGen.refreshDriverStatus],
      refreshDriverStatus
    )
  }
  yield* Saga.chainAction2(
    [FsGen.kbfsDaemonRpcStatusChanged, FsGen.setDriverStatus, FsGen.refreshMountDirsAfter10s],
    refreshMountDirs
  )
  yield* Saga.chainAction(FsGen.openAndUpload, openAndUpload)
  yield* Saga.chainAction2([FsGen.userFileEditsLoad], loadUserFileEdits)
  yield* Saga.chainAction(FsGen.openFilesFromWidget, openFilesFromWidget)
  if (isWindows) {
    yield* Saga.chainAction(FsGen.driverEnable, installCachedDokan)
    yield* Saga.chainAction2(FsGen.driverDisable as any, uninstallDokanConfirm as any)
    yield* Saga.chainAction2(FsGen.driverDisabling, uninstallDokan)
  } else {
    yield* Saga.chainAction(FsGen.driverEnable, driverEnableFuse)
    yield* Saga.chainAction2(FsGen.driverDisable, uninstallKBFSConfirm)
    yield* Saga.chainAction2(FsGen.driverDisabling, uninstallKBFS)
  }
  yield* Saga.chainAction2(FsGen.openSecurityPreferences, openSecurityPreferences)
  yield* Saga.chainAction2(FsGen.openSecurityPreferences, openSecurityPreferences)
  yield* Saga.chainAction2(ConfigGen.changedFocus, changedFocus)
  yield* Saga.chainAction2(
    [FsGen.setSfmiBannerDismissed, FsGen.driverEnable, FsGen.driverDisable],
    setSfmiBannerDismissed
  )
}

export default platformSpecificSaga
