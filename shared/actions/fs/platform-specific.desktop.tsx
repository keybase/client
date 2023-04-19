import * as ConfigGen from '../config-gen'
import * as FsGen from '../fs-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Tabs from '../../constants/tabs'
import * as Container from '../../util/container'
import {isWindows, isLinux, pathSep} from '../../constants/platform.desktop'
import logger from '../../logger'
import {errorToActionOrThrow} from './shared'
import * as RouteTreeGen from '../route-tree-gen'
import * as Path from '../../util/path'
import KB2 from '../../util/electron.desktop'

const {openPathInFinder, openURL, getPathType, selectFilesToUploadDialog} = KB2.functions
const {
  exitApp,
  relaunchApp,
  uninstallKBFSDialog,
  uninstallDokanDialog,
  windowsCheckMountFromOtherDokanInstall,
  installCachedDokan,
  uninstallDokan,
} = KB2.functions

// _openPathInSystemFileManagerPromise opens `openPath` in system file manager.
// If isFolder is true, it just opens it. Otherwise, it shows it in its parent
// folder. This function does not check if the file exists, or try to convert
// KBFS paths. Caller should take care of those.
const _openPathInSystemFileManagerPromise = async (openPath: string, isFolder: boolean): Promise<void> =>
  openPathInFinder?.(openPath, isFolder)

const openLocalPathInSystemFileManager = async (
  _: unknown,
  action: FsGen.OpenLocalPathInSystemFileManagerPayload
) => {
  try {
    if (getPathType) {
      const pathType = await getPathType(action.payload.localPath)
      return _openPathInSystemFileManagerPromise(action.payload.localPath, pathType === 'directory')
    } else {
      throw new Error('impossible')
    }
  } catch (e) {
    return errorToActionOrThrow(e)
  }
}

const escapeBackslash = isWindows
  ? (pathElem: string): string =>
      pathElem
        .replace(/‰/g, '‰2030')
        .replace(/([<>:"/\\|?*])/g, (_, c) => '‰' + new Buffer(c).toString('hex'))
  : (pathElem: string): string => pathElem

const _rebaseKbfsPathToMountLocation = (kbfsPath: Types.Path, mountLocation: string) =>
  Path.join(mountLocation, Types.getPathElements(kbfsPath).slice(1).map(escapeBackslash).join(pathSep))

const openPathInSystemFileManager = async (
  state: Container.TypedState,
  action: FsGen.OpenPathInSystemFileManagerPayload
) =>
  state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Enabled && state.fs.sfmi.directMountDir
    ? _openPathInSystemFileManagerPromise(
        _rebaseKbfsPathToMountLocation(action.payload.path, state.fs.sfmi.directMountDir),
        ![Types.PathKind.InGroupTlf, Types.PathKind.InTeamTlf].includes(
          Constants.parsePath(action.payload.path).kind
        ) || Constants.getPathItem(state.fs.pathItems, action.payload.path).type === Types.PathType.Folder
      ).catch(e => errorToActionOrThrow(action.payload.path, e))
    : new Promise<void>((resolve, reject) => {
        if (state.fs.sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) {
          // This usually indicates a developer error as
          // openPathInSystemFileManager shouldn't be used when FUSE integration
          // is not enabled. So just blackbar to encourage a log send.
          reject(new Error('FUSE integration is not enabled'))
        } else {
          logger.warn('empty directMountDir') // if this happens it might be a race?
          resolve()
        }
      })

const fuseStatusToUninstallExecPath = isWindows
  ? (status: RPCTypes.FuseStatus) => {
      const field = status?.status?.fields?.find(({key}) => key === 'uninstallString')
      return field?.value
    }
  : () => null

const fuseStatusToActions =
  (previousStatusType: Types.DriverStatusType) => (status: RPCTypes.FuseStatus | null) => {
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

const refreshDriverStatus = async (
  state: Container.TypedState,
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
      const m = await RPCTypes.kbfsMountGetCurrentMountDirRpcPromise()
      status = await (windowsCheckMountFromOtherDokanInstall?.(m, status) ?? Promise.resolve(status))
    }
    return fuseStatusToActions(state.fs.sfmi.driverStatus.type)(status)
  }
  return false
}

const fuseInstallResultIsKextPermissionError = (result: RPCTypes.InstallResult): boolean =>
  result?.componentResults?.findIndex(
    c => c.name === 'fuse' && c.exitCode === Constants.ExitCodeFuseKextPermissionError
  ) !== -1

const driverEnableFuse = async (_: unknown, action: FsGen.DriverEnablePayload) => {
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
  const remove = await (uninstallKBFSDialog?.() ?? Promise.resolve(false))
  return remove ? FsGen.createDriverDisabling() : false
}

const uninstallKBFS = async () =>
  RPCTypes.installUninstallKBFSRpcPromise().then(() => {
    // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
    relaunchApp?.()
    exitApp?.(0)
  })

const uninstallDokanConfirm = async (
  state: Container.TypedState
): Promise<Container.TypedActions | false> => {
  if (state.fs.sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) {
    return false
  }
  if (!state.fs.sfmi.driverStatus.dokanUninstallExecPath) {
    await uninstallDokanDialog?.()
    return FsGen.createRefreshDriverStatus()
  }
  return FsGen.createDriverDisabling()
}

const onUninstallDokan = async (state: Container.TypedState) => {
  if (state.fs.sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) return
  const execPath: string = state.fs.sfmi.driverStatus.dokanUninstallExecPath || ''
  logger.info('Invoking dokan uninstaller', execPath)
  try {
    await uninstallDokan?.(execPath)
  } catch {}
  return FsGen.createRefreshDriverStatus()
}

const openSecurityPreferences = () => {
  openURL?.('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
    .then(() => {
      logger.info('Opened Security Preferences')
    })
    .catch(() => {})
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
const onInstallCachedDokan = async () => {
  try {
    await installCachedDokan?.()
    return FsGen.createRefreshDriverStatus()
  } catch (e) {
    return errorToActionOrThrow(e)
  }
}

const openAndUpload = async (_: unknown, action: FsGen.OpenAndUploadPayload) => {
  const localPaths = await (selectFilesToUploadDialog?.(action.payload.type, action.payload.parentPath) ??
    Promise.resolve([]))
  return localPaths.map(localPath => FsGen.createUpload({localPath, parentPath: action.payload.parentPath}))
}

const loadUserFileEdits = async () => {
  try {
    const writerEdits = await RPCTypes.SimpleFSSimpleFSUserEditHistoryRpcPromise()
    return FsGen.createUserFileEditsLoaded({
      tlfUpdates: Constants.userTlfHistoryRPCToState(writerEdits || []),
    })
  } catch (error) {
    return errorToActionOrThrow(error)
  }
}

const openFilesFromWidget = (_: unknown, {payload: {path}}: FsGen.OpenFilesFromWidgetPayload) => [
  ConfigGen.createShowMain(),
  ...(path
    ? [Constants.makeActionForOpenPathInFilesTab(path)]
    : ([RouteTreeGen.createNavigateAppend({path: [Tabs.fsTab]})] as any)),
]

const changedFocus = (state: Container.TypedState, action: ConfigGen.ChangedFocusPayload) =>
  action.payload.appFocused &&
  state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Disabled &&
  state.fs.sfmi.driverStatus.kextPermissionError &&
  FsGen.createDriverEnable({isRetry: true})

const refreshMountDirs = async (
  state: Container.TypedState,
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

const setSfmiBannerDismissed = async (
  _: Container.TypedState,
  action: FsGen.SetSfmiBannerDismissedPayload | FsGen.DriverEnablePayload | FsGen.DriverDisablePayload
) => {
  switch (action.type) {
    case FsGen.setSfmiBannerDismissed:
      await RPCTypes.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed: action.payload.dismissed})
      return
    case FsGen.driverEnable:
    case FsGen.driverDisable:
      await RPCTypes.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed: false})
      return
  }
}

const initPlatformSpecific = () => {
  Container.listenAction(FsGen.openLocalPathInSystemFileManager, openLocalPathInSystemFileManager)
  Container.listenAction(FsGen.openPathInSystemFileManager, openPathInSystemFileManager)
  if (!isLinux) {
    Container.listenAction([FsGen.kbfsDaemonRpcStatusChanged, FsGen.refreshDriverStatus], refreshDriverStatus)
  }
  Container.listenAction(
    [FsGen.kbfsDaemonRpcStatusChanged, FsGen.setDriverStatus, FsGen.refreshMountDirsAfter10s],
    refreshMountDirs
  )
  Container.listenAction(FsGen.openAndUpload, openAndUpload)
  Container.listenAction([FsGen.userFileEditsLoad], loadUserFileEdits)
  Container.listenAction(FsGen.openFilesFromWidget, openFilesFromWidget)
  if (isWindows) {
    Container.listenAction(FsGen.driverEnable, onInstallCachedDokan)
    Container.listenAction(FsGen.driverDisable as any, uninstallDokanConfirm as any)
    Container.listenAction(FsGen.driverDisabling, onUninstallDokan)
  } else {
    Container.listenAction(FsGen.driverEnable, driverEnableFuse)
    Container.listenAction(FsGen.driverDisable, uninstallKBFSConfirm)
    Container.listenAction(FsGen.driverDisabling, uninstallKBFS)
  }
  Container.listenAction(FsGen.openSecurityPreferences, openSecurityPreferences)
  Container.listenAction(ConfigGen.changedFocus, changedFocus)
  Container.listenAction(
    [FsGen.setSfmiBannerDismissed, FsGen.driverEnable, FsGen.driverDisable],
    setSfmiBannerDismissed
  )
}

export default initPlatformSpecific
