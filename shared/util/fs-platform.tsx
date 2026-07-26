import * as T from '@/constants/types'
import * as Constants from '@/constants/fs'
import logger from '@/logger'
import KB2 from '@/util/electron'
import {isWindows, pathSep, isDarwin} from '@/constants/platform'
import {uint8ArrayToHex} from '@/util/uint8array'
import {join} from '@/util/path'
import {ExitCodeFuseKextPermissionError} from '@/constants/values'
import {unnormalizePath} from '@/styles'
import {launchImageLibraryAsync} from '@/util/expo-image-picker'
import {pickDocumentsAsync} from '@/util/expo-document-picker.native'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '@/util/platform-specific'
import {fsCacheDir, fsDownloadDir, androidAddCompleteDownload} from 'react-native-kb'
import {registerExternalResetter} from '@/util/zustand'

// Desktop-only exports (stubs on mobile)
export const fuseStatusToDriverStatus = (status?: T.RPCGen.FuseStatus): T.FS.DriverStatus => {
  if (isMobile || !status) {
    return Constants.defaultDriverStatus
  }
  const getUninstallExecPath = isWindows
    ? (s: T.RPCGen.FuseStatus) => {
        const field = s.status.fields?.find(({key}) => key === 'uninstallString')
        return field?.value
      }
    : () => undefined

  if (status.kextStarted) {
    return {
      ...Constants.emptyDriverStatusEnabled,
      dokanOutdated: status.installAction === T.RPCGen.InstallAction.upgrade,
      dokanUninstallExecPath: getUninstallExecPath(status),
    }
  }
  return Constants.emptyDriverStatusDisabled
}

export const openLocalPathInSystemFileManagerDesktop = async (localPath: string) => {
  if (isMobile) {
    return
  }
  const {openPathInFinder, getPathType} = KB2.functions
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
  if (isMobile) {
    return
  }
  if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
    throw new Error('FUSE integration is not enabled')
  }
  if (!directMountDir) {
    logger.warn('empty directMountDir')
    return
  }

  const {openPathInFinder} = KB2.functions

  const escapeBackslash = isWindows
    ? (pathElem: string): string =>
        pathElem
          .replace(/‰/g, '‰2030')
          .replace(/([<>:"/\\|?*])/g, (_, c: Uint8Array) => '‰' + uint8ArrayToHex(c))
    : (pathElem: string): string => pathElem

  const rebaseKbfsPathToMountLocation = (kbfsPath: T.FS.Path, mountLocation: string) =>
    join(mountLocation, T.FS.getPathElements(kbfsPath).slice(1).map(escapeBackslash).join(pathSep))

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

export const refreshDriverStatusDesktop = async (): Promise<T.RPCGen.FuseStatus | undefined> => {
  if (isMobile) {
    await Promise.resolve()
    return undefined
  }
  const {windowsCheckMountFromOtherDokanInstall} = KB2.functions

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
  if (isMobile) {
    await Promise.resolve()
    return {directMountDir: '', preferredMountDirs: [] as string[]}
  }
  const directMountDir = await T.RPCGen.kbfsMountGetCurrentMountDirRpcPromise()
  const preferredMountDirs = await T.RPCGen.kbfsMountGetPreferredMountDirsRpcPromise()
  return {directMountDir, preferredMountDirs: preferredMountDirs || []}
}

export const setSfmiBannerDismissedDesktop = async (dismissed: boolean) => {
  if (isMobile) {
    return
  }
  await T.RPCGen.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed})
}

export const afterDriverEnabledDesktop = async (
  isRetry: boolean
): Promise<'noop' | 'refresh' | 'kextPermissionError' | 'kextPermissionErrorRetry'> => {
  if (isMobile) {
    await Promise.resolve()
    return 'noop'
  }
  const {installCachedDokan} = KB2.functions

  const isKextPermissionError = (result: T.RPCGen.InstallResult): boolean =>
    result.componentResults?.findIndex(
      c => c.name === 'fuse' && c.exitCode === ExitCodeFuseKextPermissionError
    ) !== -1

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

export const afterDriverDisableDesktop = async (
  driverStatus: T.FS.DriverStatus
): Promise<'noop' | 'disabling' | 'refresh'> => {
  if (isMobile) {
    await Promise.resolve()
    return 'noop'
  }
  const {uninstallKBFSDialog, uninstallDokanDialog} = KB2.functions

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
  if (isMobile) {
    return
  }
  const {relaunchApp, exitApp, uninstallDokan} = KB2.functions

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
  if (isMobile) {
    return
  }
  const {openURL} = KB2.functions
  await openURL?.('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
}

export const selectFilesToUploadDesktop = async (type: T.FS.OpenDialogType, parentPath: T.FS.Path) => {
  if (isMobile) {
    await Promise.resolve()
    return [] as string[]
  }
  const {selectFilesToUploadDialog} = KB2.functions
  return await (selectFilesToUploadDialog?.(type, parentPath) ?? Promise.resolve([]))
}

export const uploadFromDragAndDropDesktop = async (localPaths: Array<string>) => {
  if (isMobile) {
    await Promise.resolve()
    return localPaths
  }
  const {darwinCopyToKBFSTempUploadFile} = KB2.functions

  if (isDarwin && darwinCopyToKBFSTempUploadFile) {
    const dir = await T.RPCGen.SimpleFSSimpleFSMakeTempDirForUploadRpcPromise()
    return Promise.all(localPaths.map(async localPath => darwinCopyToKBFSTempUploadFile(dir, localPath)))
  }
  return localPaths
}

// Mobile-only exports (stubs on desktop)
export const pickAndUploadMobile = async (
  type: T.FS.MobilePickType,
  parentPath: T.FS.Path,
  upload: (parentPath: T.FS.Path, localPath: string) => void
) => {
  if (!isMobile || type === T.FS.MobilePickType.File) {
    return
  }
  const result = await launchImageLibraryAsync(type, true, true)
  if (result.canceled) {
    return
  }
  for (const asset of result.assets) {
    upload(parentPath, unnormalizePath(asset.uri))
  }
}

export const pickDocumentsMobile = async (
  parentPath: T.FS.Path,
  upload: (parentPath: T.FS.Path, localPath: string) => void
) => {
  if (!isMobile) {
    return
  }
  const result = await pickDocumentsAsync(true)
  if (result.canceled) {
    return
  }
  result.assets.forEach(asset => upload(parentPath, unnormalizePath(asset.uri)))
}

export const finishedDownloadWithIntentMobile = async (
  downloadState: T.FS.DownloadState,
  downloadIntent: T.FS.DownloadIntent,
  mimeType: string
) => {
  if (!isMobile) {
    return
  }
  switch (downloadIntent) {
    case T.FS.DownloadIntent.CameraRoll:
      await saveAttachmentToCameraRoll(downloadState.localPath, mimeType)
      return
    case T.FS.DownloadIntent.Share:
      await showShareActionSheet({filePath: downloadState.localPath, mimeType})
      return
    case T.FS.DownloadIntent.None:
      return
    default:
      return
  }
}

export const afterKbfsDaemonRpcStatusChangedMobile = async () => {
  if (!isMobile || !isAndroid) {
    return
  }
  await T.RPCGen.SimpleFSSimpleFSConfigureDownloadRpcPromise({
    cacheDirOverride: fsCacheDir,
    downloadDirOverride: fsDownloadDir,
  })
}

const finishedRegularDownloadIDs = new Set<string>()

// module scope outlives sign-out; holds the previous user's download ids
registerExternalResetter('fs-finished-regular-downloads', () => {
  finishedRegularDownloadIDs.clear()
})

export const finishedRegularDownloadMobile = async (
  downloadID: string,
  downloadState: T.FS.DownloadState,
  downloadInfo: T.FS.DownloadInfo,
  mimeType: string
) => {
  if (
    !isMobile ||
    !isAndroid ||
    downloadState.error ||
    !downloadState.localPath ||
    finishedRegularDownloadIDs.has(downloadID)
  ) {
    return
  }
  finishedRegularDownloadIDs.add(downloadID)

  try {
    await androidAddCompleteDownload({
      description: `Keybase downloaded ${downloadInfo.filename}`,
      mime: mimeType,
      path: downloadState.localPath,
      showNotification: true,
      title: downloadInfo.filename,
    })
  } catch {
    logger.warn('Failed to addCompleteDownload')
  }
}
