import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Constants from '../fs'
import * as Tabs from '../tabs'
import {isWindows, isLinux, pathSep, isDarwin} from '../platform.desktop'
import logger from '@/logger'
import * as Path from '@/util/path'
import KB2 from '@/util/electron.desktop'
import {uint8ArrayToHex} from 'uint8array-extras'

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
        .replace(/([<>:"/\\|?*])/g, (_, c: Uint8Array) => '‰' + uint8ArrayToHex(c))
  : (pathElem: string): string => pathElem

const _rebaseKbfsPathToMountLocation = (kbfsPath: T.FS.Path, mountLocation: string) =>
  Path.join(mountLocation, T.FS.getPathElements(kbfsPath).slice(1).map(escapeBackslash).join(pathSep))

const fuseStatusToUninstallExecPath = isWindows
  ? (status: T.RPCGen.FuseStatus) => {
      const field = status.status.fields?.find(({key}) => key === 'uninstallString')
      return field?.value
    }
  : () => undefined

const fuseStatusToActions =
  (previousStatusType: T.FS.DriverStatusType) => (status: T.RPCGen.FuseStatus | undefined) => {
    if (!status) {
      C.useFSState.getState().dispatch.setDriverStatus(Constants.defaultDriverStatus)
      return
    }

    if (status.kextStarted) {
      C.useFSState.getState().dispatch.setDriverStatus({
        ...Constants.emptyDriverStatusEnabled,
        dokanOutdated: status.installAction === T.RPCGen.InstallAction.upgrade,
        dokanUninstallExecPath: fuseStatusToUninstallExecPath(status),
      })
    } else {
      C.useFSState.getState().dispatch.setDriverStatus(Constants.emptyDriverStatusDisabled)
    }

    if (status.kextStarted && previousStatusType === T.FS.DriverStatusType.Disabled) {
      C.useFSState
        .getState()
        .dispatch.dynamic.openPathInSystemFileManagerDesktop?.(T.FS.stringToPath('/keybase'))
    }
  }

const fuseInstallResultIsKextPermissionError = (result: T.RPCGen.InstallResult): boolean =>
  result.componentResults?.findIndex(
    c => c.name === 'fuse' && c.exitCode === Constants.ExitCodeFuseKextPermissionError
  ) !== -1

const driverEnableFuse = async (isRetry: boolean) => {
  const result = await T.RPCGen.installInstallFuseRpcPromise()
  if (fuseInstallResultIsKextPermissionError(result)) {
    C.useFSState.getState().dispatch.driverKextPermissionError()
    if (!isRetry) {
      C.useRouterState.getState().dispatch.navigateAppend('kextPermission')
    }
  } else {
    await T.RPCGen.installInstallKBFSRpcPromise() // restarts kbfsfuse
    await T.RPCGen.kbfsMountWaitForMountsRpcPromise()
    C.useFSState.getState().dispatch.dynamic.refreshDriverStatusDesktop?.()
  }
}

const uninstallKBFSConfirm = async () => {
  const remove = await (uninstallKBFSDialog?.() ?? Promise.resolve(false))
  if (remove) {
    C.useFSState.getState().dispatch.driverDisabling()
  }
}

const uninstallKBFS = async () =>
  T.RPCGen.installUninstallKBFSRpcPromise().then(() => {
    // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
    relaunchApp?.()
    exitApp?.(0)
  })

const uninstallDokanConfirm = async () => {
  const driverStatus = C.useFSState.getState().sfmi.driverStatus
  if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
    return
  }
  if (!driverStatus.dokanUninstallExecPath) {
    await uninstallDokanDialog?.()
    C.useFSState.getState().dispatch.dynamic.refreshDriverStatusDesktop?.()
    return
  }
  C.useFSState.getState().dispatch.driverDisabling()
}

const onUninstallDokan = async () => {
  const driverStatus = C.useFSState.getState().sfmi.driverStatus
  if (driverStatus.type !== T.FS.DriverStatusType.Enabled) return
  const execPath: string = driverStatus.dokanUninstallExecPath || ''
  logger.info('Invoking dokan uninstaller', execPath)
  try {
    await uninstallDokan?.(execPath)
  } catch {}
  C.useFSState.getState().dispatch.dynamic.refreshDriverStatusDesktop?.()
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
const onInstallCachedDokan = async () => {
  try {
    await installCachedDokan?.()
    C.useFSState.getState().dispatch.dynamic.refreshDriverStatusDesktop?.()
  } catch (e) {
    Constants.errorToActionOrThrow(e)
  }
}

const initPlatformSpecific = () => {
  C.useConfigState.subscribe((s, old) => {
    if (s.appFocused === old.appFocused) return
    C.useFSState.getState().dispatch.onChangedFocus(s.appFocused)
  })

  C.useFSState.setState(s => {
    s.dispatch.dynamic.uploadFromDragAndDropDesktop = C.wrapErrors(
      (parentPath: T.FS.Path, localPaths: string[]) => {
        const {upload} = C.useFSState.getState().dispatch
        const f = async () => {
          if (isDarwin && darwinCopyToKBFSTempUploadFile) {
            const dir = await T.RPCGen.SimpleFSSimpleFSMakeTempDirForUploadRpcPromise()
            const lp = await Promise.all(
              localPaths.map(async localPath => darwinCopyToKBFSTempUploadFile(dir, localPath))
            )
            lp.forEach(localPath => upload(parentPath, localPath))
          } else {
            localPaths.forEach(localPath => upload(parentPath, localPath))
          }
        }
        C.ignorePromise(f())
      }
    )

    s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop = C.wrapErrors((localPath: string) => {
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
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.openPathInSystemFileManagerDesktop = C.wrapErrors((path: T.FS.Path) => {
      const f = async () => {
        const {sfmi, pathItems} = C.useFSState.getState()
        return sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled && sfmi.directMountDir
          ? _openPathInSystemFileManagerPromise(
              _rebaseKbfsPathToMountLocation(path, sfmi.directMountDir),
              ![T.FS.PathKind.InGroupTlf, T.FS.PathKind.InTeamTlf].includes(Constants.parsePath(path).kind) ||
                Constants.getPathItem(pathItems, path).type === T.FS.PathType.Folder
            ).catch((e: unknown) => Constants.errorToActionOrThrow(e, path))
          : new Promise<void>((resolve, reject) => {
              if (sfmi.driverStatus.type !== T.FS.DriverStatusType.Enabled) {
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
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.refreshDriverStatusDesktop = C.wrapErrors(() => {
      const f = async () => {
        let status = await T.RPCGen.installFuseStatusRpcPromise({
          bundleVersion: '',
        })
        if (isWindows && status.installStatus !== T.RPCGen.InstallStatus.installed) {
          const m = await T.RPCGen.kbfsMountGetCurrentMountDirRpcPromise()
          status = await (windowsCheckMountFromOtherDokanInstall?.(m, status) ?? Promise.resolve(status))
        }
        fuseStatusToActions(C.useFSState.getState().sfmi.driverStatus.type)(status)
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.refreshMountDirsDesktop = C.wrapErrors(() => {
      const f = async () => {
        const {sfmi, dispatch} = C.useFSState.getState()
        const driverStatus = sfmi.driverStatus
        if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
          return
        }
        const directMountDir = await T.RPCGen.kbfsMountGetCurrentMountDirRpcPromise()
        const preferredMountDirs = await T.RPCGen.kbfsMountGetPreferredMountDirsRpcPromise()
        dispatch.setDirectMountDir(directMountDir)
        dispatch.setPreferredMountDirs(preferredMountDirs || [])
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.setSfmiBannerDismissedDesktop = C.wrapErrors((dismissed: boolean) => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed})
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.afterDriverEnabled = C.wrapErrors((isRetry: boolean) => {
      const f = async () => {
        C.useFSState.getState().dispatch.dynamic.setSfmiBannerDismissedDesktop?.(false)
        if (isWindows) {
          await onInstallCachedDokan()
        } else {
          await driverEnableFuse(isRetry)
        }
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.afterDriverDisable = C.wrapErrors(() => {
      const f = async () => {
        C.useFSState.getState().dispatch.dynamic.setSfmiBannerDismissedDesktop?.(false)
        if (isWindows) {
          await uninstallDokanConfirm()
        } else {
          await uninstallKBFSConfirm()
        }
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.afterDriverDisabling = C.wrapErrors(() => {
      const f = async () => {
        if (isWindows) {
          await onUninstallDokan()
        } else {
          await uninstallKBFS()
        }
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.openSecurityPreferencesDesktop = C.wrapErrors(() => {
      const f = async () => {
        await openURL?.('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.openFilesFromWidgetDesktop = C.wrapErrors((path: T.FS.Path) => {
      C.useConfigState.getState().dispatch.showMain()
      if (path) {
        Constants.makeActionForOpenPathInFilesTab(path)
      } else {
        C.useRouterState.getState().dispatch.navigateAppend(Tabs.fsTab)
      }
    })

    s.dispatch.dynamic.openAndUploadDesktop = C.wrapErrors(
      (type: T.FS.OpenDialogType, parentPath: T.FS.Path) => {
        const f = async () => {
          const localPaths = await (selectFilesToUploadDialog?.(type, parentPath ?? undefined) ??
            Promise.resolve([]))
          localPaths.forEach(localPath => C.useFSState.getState().dispatch.upload(parentPath, localPath))
        }
        C.ignorePromise(f())
      }
    )

    if (!isLinux) {
      s.dispatch.dynamic.afterKbfsDaemonRpcStatusChanged = C.wrapErrors(() => {
        const {kbfsDaemonStatus, dispatch} = C.useFSState.getState()
        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          dispatch.dynamic.refreshDriverStatusDesktop?.()
        }
        dispatch.dynamic.refreshMountDirsDesktop?.()
      })
    }
  })
}

export default initPlatformSpecific
