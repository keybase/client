import * as RouterConstants from '../../constants/router2'
import * as Z from '../../util/zustand'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as ConfigConstants from '../../constants/config'
import * as Tabs from '../../constants/tabs'
import {isWindows, isLinux, pathSep, isDarwin} from '../../constants/platform.desktop'
import logger from '../../logger'
import * as Path from '../../util/path'
import KB2 from '../../util/electron.desktop'

const {openPathInFinder, openURL, getPathType, selectFilesToUploadDialog} = KB2.functions
const {darwinCopyToKBFSTempUploadFile, relaunchApp, uninstallKBFSDialog, uninstallDokanDialog} = KB2.functions
const {exitApp, windowsCheckMountFromOtherDokanInstall, installCachedDokan, uninstallDokan} = KB2.functions

// _openPathInSystemFileManagerPromise opens `openPath` in system file manager.
// If isFolder is true, it just opens it. Otherwise, it shows it in its parent
// folder. This function does not check if the file exists, or try to convert
// KBFS paths. Caller should take care of those.
const _openPathInSystemFileManagerPromise = async (openPath: string, isFolder: boolean): Promise<void> =>
  openPathInFinder?.(openPath, isFolder)

const escapeBackslash = isWindows
  ? (pathElem: string): string =>
      pathElem
        .replace(/‰/g, '‰2030')
        .replace(/([<>:"/\\|?*])/g, (_, c) => '‰' + new Buffer(c).toString('hex'))
  : (pathElem: string): string => pathElem

const _rebaseKbfsPathToMountLocation = (kbfsPath: Types.Path, mountLocation: string) =>
  Path.join(mountLocation, Types.getPathElements(kbfsPath).slice(1).map(escapeBackslash).join(pathSep))

const fuseStatusToUninstallExecPath = isWindows
  ? (status: RPCTypes.FuseStatus) => {
      const field = status?.status?.fields?.find(({key}) => key === 'uninstallString')
      return field?.value
    }
  : () => undefined

const fuseStatusToActions =
  (previousStatusType: Types.DriverStatusType) => (status: RPCTypes.FuseStatus | undefined) => {
    if (!status) {
      Constants.useState.getState().dispatch.setDriverStatus(Constants.defaultDriverStatus)
      return
    }

    if (status.kextStarted) {
      Constants.useState.getState().dispatch.setDriverStatus({
        ...Constants.emptyDriverStatusEnabled,
        dokanOutdated: status.installAction === RPCTypes.InstallAction.upgrade,
        dokanUninstallExecPath: fuseStatusToUninstallExecPath(status),
      })
    } else {
      Constants.useState.getState().dispatch.setDriverStatus(Constants.emptyDriverStatusDisabled)
    }

    if (status.kextStarted && previousStatusType === Types.DriverStatusType.Disabled) {
      Constants.useState
        .getState()
        .dispatch.dynamic.openPathInSystemFileManagerDesktop?.(Types.stringToPath('/keybase'))
    }
  }

const fuseInstallResultIsKextPermissionError = (result: RPCTypes.InstallResult): boolean =>
  result?.componentResults?.findIndex(
    c => c.name === 'fuse' && c.exitCode === Constants.ExitCodeFuseKextPermissionError
  ) !== -1

const driverEnableFuse = async (isRetry: boolean) => {
  const result = await RPCTypes.installInstallFuseRpcPromise()
  if (fuseInstallResultIsKextPermissionError(result)) {
    Constants.useState.getState().dispatch.driverKextPermissionError()
    if (!isRetry) {
      RouterConstants.useState.getState().dispatch.navigateAppend('kextPermission')
    }
  } else {
    await RPCTypes.installInstallKBFSRpcPromise() // restarts kbfsfuse
    await RPCTypes.kbfsMountWaitForMountsRpcPromise()
    Constants.useState.getState().dispatch.dynamic.refreshDriverStatusDesktop?.()
  }
}

const uninstallKBFSConfirm = async () => {
  const remove = await (uninstallKBFSDialog?.() ?? Promise.resolve(false))
  if (remove) {
    Constants.useState.getState().dispatch.driverDisabling()
  }
}

const uninstallKBFS = async () =>
  RPCTypes.installUninstallKBFSRpcPromise().then(() => {
    // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
    relaunchApp?.()
    exitApp?.(0)
  })

const uninstallDokanConfirm = async () => {
  const driverStatus = Constants.useState.getState().sfmi.driverStatus
  if (driverStatus.type !== Types.DriverStatusType.Enabled) {
    return
  }
  if (!driverStatus.dokanUninstallExecPath) {
    await uninstallDokanDialog?.()
    Constants.useState.getState().dispatch.dynamic.refreshDriverStatusDesktop?.()
    return
  }
  Constants.useState.getState().dispatch.driverDisabling()
}

const onUninstallDokan = async () => {
  const driverStatus = Constants.useState.getState().sfmi.driverStatus
  if (driverStatus.type !== Types.DriverStatusType.Enabled) return
  const execPath: string = driverStatus.dokanUninstallExecPath || ''
  logger.info('Invoking dokan uninstaller', execPath)
  try {
    await uninstallDokan?.(execPath)
  } catch {}
  Constants.useState.getState().dispatch.dynamic.refreshDriverStatusDesktop?.()
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
const onInstallCachedDokan = async () => {
  try {
    await installCachedDokan?.()
    Constants.useState.getState().dispatch.dynamic.refreshDriverStatusDesktop?.()
  } catch (e) {
    Constants.errorToActionOrThrow(e)
  }
}

const initPlatformSpecific = () => {
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.appFocused === old.appFocused) return
    Constants.useState.getState().dispatch.onChangedFocus(s.appFocused)
  })

  Constants.useState.setState(s => {
    s.dispatch.dynamic.uploadFromDragAndDropDesktop = (parentPath, localPaths) => {
      const {upload} = Constants.useState.getState().dispatch
      const f = async () => {
        if (isDarwin && darwinCopyToKBFSTempUploadFile) {
          const dir = await RPCTypes.SimpleFSSimpleFSMakeTempDirForUploadRpcPromise()
          const lp = await Promise.all(
            localPaths.map(async localPath => darwinCopyToKBFSTempUploadFile(dir, localPath))
          )
          lp.forEach(localPath => upload(parentPath, localPath))
        } else {
          localPaths.forEach(localPath => upload(parentPath, localPath))
        }
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop = localPath => {
      const f = async () => {
        try {
          if (getPathType) {
            const pathType = await getPathType(localPath)
            await _openPathInSystemFileManagerPromise(localPath, pathType === 'directory')
          }
        } catch (e) {
          Constants.errorToActionOrThrow(e)
        }
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.openPathInSystemFileManagerDesktop = path => {
      const f = async () => {
        const {sfmi, pathItems} = Constants.useState.getState()
        return sfmi.driverStatus.type === Types.DriverStatusType.Enabled && sfmi.directMountDir
          ? _openPathInSystemFileManagerPromise(
              _rebaseKbfsPathToMountLocation(path, sfmi.directMountDir),
              ![Types.PathKind.InGroupTlf, Types.PathKind.InTeamTlf].includes(
                Constants.parsePath(path).kind
              ) || Constants.getPathItem(pathItems, path).type === Types.PathType.Folder
            ).catch(e => Constants.errorToActionOrThrow(path, e))
          : new Promise<void>((resolve, reject) => {
              if (sfmi.driverStatus.type !== Types.DriverStatusType.Enabled) {
                // This usually indicates a developer error as
                // openPathInSystemFileManager shouldn't be used when FUSE integration
                // is not enabled. So just blackbar to encourage a log send.
                reject(new Error('FUSE integration is not enabled'))
              } else {
                logger.warn('empty directMountDir') // if this happens it might be a race?
                resolve()
              }
            })
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.refreshDriverStatusDesktop = () => {
      const f = async () => {
        let status = await RPCTypes.installFuseStatusRpcPromise({
          bundleVersion: '',
        })
        if (isWindows && status.installStatus !== RPCTypes.InstallStatus.installed) {
          const m = await RPCTypes.kbfsMountGetCurrentMountDirRpcPromise()
          status = await (windowsCheckMountFromOtherDokanInstall?.(m, status) ?? Promise.resolve(status))
        }
        fuseStatusToActions(Constants.useState.getState().sfmi.driverStatus.type)(status)
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.refreshMountDirsDesktop = () => {
      const f = async () => {
        const {sfmi, dispatch} = Constants.useState.getState()
        const driverStatus = sfmi.driverStatus
        if (driverStatus.type !== Types.DriverStatusType.Enabled) {
          return
        }
        const directMountDir = await RPCTypes.kbfsMountGetCurrentMountDirRpcPromise()
        const preferredMountDirs = await RPCTypes.kbfsMountGetPreferredMountDirsRpcPromise()
        dispatch.setDirectMountDir(directMountDir)
        dispatch.setPreferredMountDirs(preferredMountDirs || [])
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.setSfmiBannerDismissedDesktop = dismissed => {
      const f = async () => {
        await RPCTypes.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed})
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.afterDriverEnabled = isRetry => {
      const f = async () => {
        Constants.useState.getState().dispatch.dynamic.setSfmiBannerDismissedDesktop?.(false)
        if (isWindows) {
          await onInstallCachedDokan()
        } else {
          await driverEnableFuse(isRetry)
        }
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.afterDriverDisable = () => {
      const f = async () => {
        Constants.useState.getState().dispatch.dynamic.setSfmiBannerDismissedDesktop?.(false)
        if (isWindows) {
          await uninstallDokanConfirm()
        } else {
          await uninstallKBFSConfirm()
        }
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.afterDriverDisabling = () => {
      const f = async () => {
        if (isWindows) {
          await onUninstallDokan()
        } else {
          await uninstallKBFS()
        }
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.openSecurityPreferencesDesktop = () => {
      const f = async () => {
        await openURL?.('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
      }
      Z.ignorePromise(f())
    }

    s.dispatch.dynamic.openFilesFromWidgetDesktop = path => {
      ConfigConstants.useConfigState.getState().dispatch.showMain()
      if (path) {
        Constants.makeActionForOpenPathInFilesTab(path)
      } else {
        RouterConstants.useState.getState().dispatch.navigateAppend(Tabs.fsTab)
      }
    }

    s.dispatch.dynamic.openAndUploadDesktop = (type, parentPath) => {
      const f = async () => {
        const localPaths = await (selectFilesToUploadDialog?.(type, parentPath ?? undefined) ??
          Promise.resolve([]))
        localPaths.forEach(localPath => Constants.useState.getState().dispatch.upload(parentPath, localPath))
      }
      Z.ignorePromise(f())
    }

    if (!isLinux) {
      s.dispatch.dynamic.afterKbfsDaemonRpcStatusChanged = () => {
        const {kbfsDaemonStatus, dispatch} = Constants.useState.getState()
        if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
          dispatch.dynamic.refreshDriverStatusDesktop?.()
        }
        dispatch.dynamic.refreshMountDirsDesktop?.()
      }
    }
  })
}

export default initPlatformSpecific
