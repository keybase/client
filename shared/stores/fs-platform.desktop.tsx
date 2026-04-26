import * as T from '@/constants/types'
import * as Constants from '@/constants/fs'
import KB2 from '@/util/electron.desktop'
import logger from '@/logger'
import * as Path from '@/util/path'
import {isDarwin, isWindows, pathSep} from '@/constants/platform.desktop'
import {uint8ArrayToHex} from '@/util/uint8array'
import {ExitCodeFuseKextPermissionError} from '@/constants/values'

const {openPathInFinder, getPathType, selectFilesToUploadDialog} = KB2.functions
const {darwinCopyToKBFSTempUploadFile, relaunchApp, uninstallKBFSDialog, uninstallDokanDialog} = KB2.functions
const {windowsCheckMountFromOtherDokanInstall, installCachedDokan, uninstallDokan} = KB2.functions
const {openURL, exitApp} = KB2.functions

const escapeBackslash = isWindows
  ? (pathElem: string): string =>
      pathElem
        .replace(/‰/g, '‰2030')
        .replace(/([<>:"/\\|?*])/g, (_, c: Uint8Array) => '‰' + uint8ArrayToHex(c))
  : (pathElem: string): string => pathElem

const rebaseKbfsPathToMountLocation = (kbfsPath: T.FS.Path, mountLocation: string) =>
  Path.join(mountLocation, T.FS.getPathElements(kbfsPath).slice(1).map(escapeBackslash).join(pathSep))

const getUninstallExecPath = isWindows
  ? (status: T.RPCGen.FuseStatus) => {
      const field = status.status.fields?.find(({key}) => key === 'uninstallString')
      return field?.value
    }
  : () => undefined

const isKextPermissionError = (result: T.RPCGen.InstallResult): boolean =>
  result.componentResults?.findIndex(
    c => c.name === 'fuse' && c.exitCode === ExitCodeFuseKextPermissionError
  ) !== -1

export const fuseStatusToDriverStatus = (status?: T.RPCGen.FuseStatus): T.FS.DriverStatus => {
  if (!status) {
    return Constants.defaultDriverStatus
  }
  if (status.kextStarted) {
    const dokanUninstallExecPath = getUninstallExecPath(status)
    return {
      ...Constants.emptyDriverStatusEnabled,
      dokanOutdated: status.installAction === T.RPCGen.InstallAction.upgrade,
      ...(dokanUninstallExecPath === undefined ? {} : {dokanUninstallExecPath}),
    }
  }
  return Constants.emptyDriverStatusDisabled
}

export const openLocalPathInSystemFileManagerDesktop = async (localPath: string) => {
  if (!getPathType) {
    return
  }
  const pathType = await getPathType(localPath)
  await openPathInFinder?.(localPath, pathType === 'directory')
}

export const openPathInSystemFileManagerDesktop = async (
  path: T.FS.Path,
  driverStatus: T.FS.DriverStatus,
  directMountDir: string
) => {
  if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
    throw new Error('FUSE integration is not enabled')
  }
  if (!directMountDir) {
    logger.warn('empty directMountDir')
    return
  }

  const parsedPath = Constants.parsePath(path)
  let selectDirectory = ![T.FS.PathKind.InGroupTlf, T.FS.PathKind.InTeamTlf].includes(parsedPath.kind)
  if (!selectDirectory) {
    try {
      selectDirectory =
        (
          await T.RPCGen.SimpleFSSimpleFSStatRpcPromise({
            path: Constants.pathToRPCPath(path),
            refreshSubscription: false,
          })
        ).direntType === T.RPCGen.DirentType.dir
    } catch (error) {
      logger.warn('failed to stat KBFS path before opening system file manager: ', error)
    }
  }

  await openPathInFinder?.(
    rebaseKbfsPathToMountLocation(path, directMountDir),
    selectDirectory
  )
}

export const refreshDriverStatusDesktop = async () => {
  let status = await T.RPCGen.installFuseStatusRpcPromise({
    bundleVersion: '',
  })
  if (isWindows && status.installStatus !== T.RPCGen.InstallStatus.installed) {
    const mountDir = await T.RPCGen.kbfsMountGetCurrentMountDirRpcPromise()
    status = await (windowsCheckMountFromOtherDokanInstall?.(mountDir, status) ?? Promise.resolve(status))
  }
  return status
}

export const refreshMountDirsDesktop = async () => {
  const directMountDir = await T.RPCGen.kbfsMountGetCurrentMountDirRpcPromise()
  const preferredMountDirs = await T.RPCGen.kbfsMountGetPreferredMountDirsRpcPromise()
  return {directMountDir, preferredMountDirs: preferredMountDirs || []}
}

export const setSfmiBannerDismissedDesktop = async (dismissed: boolean) => {
  await T.RPCGen.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed})
}

export const afterDriverEnabledDesktop = async (isRetry: boolean) => {
  if (isWindows) {
    await installCachedDokan?.()
    return 'refresh'
  }

  const result = await T.RPCGen.installInstallFuseRpcPromise()
  if (isKextPermissionError(result)) {
    return isRetry ? 'kextPermissionErrorRetry' : 'kextPermissionError'
  }
  await T.RPCGen.installInstallKBFSRpcPromise()
  await T.RPCGen.kbfsMountWaitForMountsRpcPromise()
  return 'refresh'
}

export const afterDriverDisableDesktop = async (driverStatus: T.FS.DriverStatus) => {
  if (isWindows) {
    if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
      return 'noop'
    }
    if (!driverStatus.dokanUninstallExecPath) {
      await uninstallDokanDialog?.()
      return 'refresh'
    }
    return 'disabling'
  }

  const remove = await (uninstallKBFSDialog?.() ?? Promise.resolve(false))
  return remove ? 'disabling' : 'noop'
}

export const afterDriverDisablingDesktop = async (driverStatus: T.FS.DriverStatus) => {
  if (isWindows) {
    if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
      return
    }
    logger.info('Invoking dokan uninstaller', driverStatus.dokanUninstallExecPath || '')
    try {
      await uninstallDokan?.(driverStatus.dokanUninstallExecPath || '')
    } catch {}
    return
  }

  await T.RPCGen.installUninstallKBFSRpcPromise()
  relaunchApp?.()
  exitApp?.(0)
}

export const openSecurityPreferencesDesktop = async () => {
  await openURL?.('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
}

export const selectFilesToUploadDesktop = async (type: T.FS.OpenDialogType, parentPath: T.FS.Path) =>
  await (selectFilesToUploadDialog?.(type, parentPath) ?? Promise.resolve([]))

export const uploadFromDragAndDropDesktop = async (localPaths: Array<string>) => {
  if (isDarwin && darwinCopyToKBFSTempUploadFile) {
    const dir = await T.RPCGen.SimpleFSSimpleFSMakeTempDirForUploadRpcPromise()
    return Promise.all(localPaths.map(async localPath => darwinCopyToKBFSTempUploadFile(dir, localPath)))
  }
  return localPaths
}

export const pickAndUploadMobile = async (
  _type: T.FS.MobilePickType,
  _parentPath: T.FS.Path,
  _upload: (parentPath: T.FS.Path, localPath: string) => void
) => {}

export const pickDocumentsMobile = async (
  _parentPath: T.FS.Path,
  _upload: (parentPath: T.FS.Path, localPath: string) => void
) => {}

export const finishedDownloadWithIntentMobile = async (
  _downloadState: T.FS.DownloadState,
  _downloadIntent: T.FS.DownloadIntent,
  _mimeType: string
) => {}

export const afterKbfsDaemonRpcStatusChangedMobile = async () => {}

export const finishedRegularDownloadMobile = async (
  _downloadID: string,
  _downloadState: T.FS.DownloadState,
  _downloadInfo: T.FS.DownloadInfo,
  _mimeType: string
) => {}
