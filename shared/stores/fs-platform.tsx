import * as T from '@/constants/types'
import * as Constants from '@/constants/fs'
import logger from '@/logger'
import type {KB2} from '@/util/electron.desktop'

const getKB2 = () => (require('@/util/electron.desktop') as {default: KB2}).default

// Desktop-only exports (stubs on mobile)
export const fuseStatusToDriverStatus = (status?: T.RPCGen.FuseStatus): T.FS.DriverStatus => {
  if (isMobile || !status) {
    return Constants.defaultDriverStatus
  }
  const {isWindows} = require('@/constants/platform.desktop') as {isWindows: boolean}

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
  const {openPathInFinder, getPathType} = getKB2().functions
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

  const {isWindows, pathSep} = require('@/constants/platform.desktop') as {isWindows: boolean; pathSep: string}
  const {uint8ArrayToHex} = require('@/util/uint8array') as {uint8ArrayToHex: (b: Uint8Array) => string}
  const {join} = require('@/util/path') as {join: (...args: string[]) => string}
  const {openPathInFinder} = getKB2().functions

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
  const {isWindows} = require('@/constants/platform.desktop') as {isWindows: boolean}
  const {windowsCheckMountFromOtherDokanInstall} = getKB2().functions

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
  const {isWindows} = require('@/constants/platform.desktop') as {isWindows: boolean}
  const {ExitCodeFuseKextPermissionError} = require('@/constants/values') as {ExitCodeFuseKextPermissionError: number}
  const {installCachedDokan} = getKB2().functions

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
  const {isWindows} = require('@/constants/platform.desktop') as {isWindows: boolean}
  const {uninstallKBFSDialog, uninstallDokanDialog} = getKB2().functions

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
  const {isWindows} = require('@/constants/platform.desktop') as {isWindows: boolean}
  const {relaunchApp, exitApp, uninstallDokan} = getKB2().functions

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
  const {openURL} = getKB2().functions
  await openURL?.('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
}

export const selectFilesToUploadDesktop = async (type: T.FS.OpenDialogType, parentPath: T.FS.Path) => {
  if (isMobile) {
    await Promise.resolve()
    return [] as string[]
  }
  const {selectFilesToUploadDialog} = getKB2().functions
  return await (selectFilesToUploadDialog?.(type, parentPath) ?? Promise.resolve([]))
}

export const uploadFromDragAndDropDesktop = async (localPaths: Array<string>) => {
  if (isMobile) {
    await Promise.resolve()
    return localPaths
  }
  const {isDarwin} = require('@/constants/platform.desktop') as {isDarwin: boolean}
  const {darwinCopyToKBFSTempUploadFile} = getKB2().functions

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
  const {unnormalizePath} = require('@/styles') as {unnormalizePath: (path: string) => string}
  const {launchImageLibraryAsync} = require('@/util/expo-image-picker') as {
    launchImageLibraryAsync: (type: T.FS.MobilePickType, multiple: boolean, resize: boolean) => Promise<{
      canceled: boolean
      assets: Array<{uri: string}>
    }>
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
  const {unnormalizePath} = require('@/styles') as {unnormalizePath: (path: string) => string}
  const {pickDocumentsAsync} = require('@/util/expo-document-picker.native') as {
    pickDocumentsAsync: (multiple: boolean) => Promise<{
      canceled: boolean
      assets: Array<{uri: string}>
    }>
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
  const {saveAttachmentToCameraRoll, showShareActionSheet} = require('@/util/platform-specific') as {
    saveAttachmentToCameraRoll: (filePath: string, mimeType: string) => Promise<void>
    showShareActionSheet: (opts: {filePath?: string; mimeType: string}) => Promise<unknown>
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
  const {fsCacheDir, fsDownloadDir} = require('react-native-kb') as {
    fsCacheDir: string
    fsDownloadDir: string
  }
  await T.RPCGen.SimpleFSSimpleFSConfigureDownloadRpcPromise({
    cacheDirOverride: fsCacheDir,
    downloadDirOverride: fsDownloadDir,
  })
}

const finishedRegularDownloadIDs = new Set<string>()

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

  const {androidAddCompleteDownload} = require('react-native-kb') as {
    androidAddCompleteDownload: (opts: {
      description: string
      mime: string
      path: string
      showNotification: boolean
      title: string
    }) => Promise<void>
  }

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
