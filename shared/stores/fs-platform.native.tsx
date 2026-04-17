import * as Styles from '@/styles'
import * as T from '@/constants/types'
import {launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {pickDocumentsAsync} from '@/util/expo-document-picker.native'
import {androidAddCompleteDownload, fsCacheDir, fsDownloadDir} from 'react-native-kb'
import logger from '@/logger'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '@/util/platform-specific'
import {isAndroid} from '@/constants/platform.native'
import * as Constants from '@/constants/fs'

const finishedRegularDownloadIDs = new Set<string>()

export const pickAndUploadMobile = async (
  type: T.FS.MobilePickType,
  parentPath: T.FS.Path,
  upload: (parentPath: T.FS.Path, localPath: string) => void
) => {
  if (type === T.FS.MobilePickType.File) {
    return
  }
  const result = await launchImageLibraryAsync(type, true, true)
  if (result.canceled) {
    return
  }
  for (const asset of result.assets) {
    upload(parentPath, Styles.unnormalizePath(asset.uri))
  }
}

export const pickDocumentsMobile = async (
  parentPath: T.FS.Path,
  upload: (parentPath: T.FS.Path, localPath: string) => void
) => {
  const result = await pickDocumentsAsync(true)
  if (result.canceled) {
    return
  }
  result.assets.forEach(asset => upload(parentPath, Styles.unnormalizePath(asset.uri)))
}

export const finishedDownloadWithIntentMobile = async (
  downloadState: T.FS.DownloadState,
  downloadIntent: T.FS.DownloadIntent,
  mimeType: string
) => {
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
  if (!isAndroid) {
    return
  }
  await T.RPCGen.SimpleFSSimpleFSConfigureDownloadRpcPromise({
    cacheDirOverride: fsCacheDir,
    downloadDirOverride: fsDownloadDir,
  })
}

export const finishedRegularDownloadMobile = async (
  downloadID: string,
  downloadState: T.FS.DownloadState,
  downloadInfo: T.FS.DownloadInfo,
  mimeType: string
) => {
  if (!isAndroid || finishedRegularDownloadIDs.has(downloadID)) {
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

export const fuseStatusToDriverStatus = (_status?: T.RPCGen.FuseStatus): T.FS.DriverStatus =>
  Constants.defaultDriverStatus

export const openLocalPathInSystemFileManagerDesktop = async (_localPath: string) => {}

export const openPathInSystemFileManagerDesktop = async (
  _path: T.FS.Path,
  _pathItems: T.FS.PathItems,
  _driverStatus: T.FS.DriverStatus,
  _directMountDir: string
) => {}

export const refreshDriverStatusDesktop = async () => {
  await Promise.resolve()
  return undefined
}

export const refreshMountDirsDesktop = async () => {
  await Promise.resolve()
  return {directMountDir: '', preferredMountDirs: [] as string[]}
}

export const setSfmiBannerDismissedDesktop = async (_dismissed: boolean) => {}

export const afterDriverEnabledDesktop = async (_isRetry: boolean) => {
  await Promise.resolve()
  return 'noop' as const
}

export const afterDriverDisableDesktop = async (_driverStatus: T.FS.DriverStatus) => {
  await Promise.resolve()
  return 'noop' as const
}

export const afterDriverDisablingDesktop = async (_driverStatus: T.FS.DriverStatus) => {}

export const openSecurityPreferencesDesktop = async () => {}

export const selectFilesToUploadDesktop = async (_type: T.FS.OpenDialogType, _parentPath: T.FS.Path) => {
  await Promise.resolve()
  return [] as string[]
}

export const uploadFromDragAndDropDesktop = async (localPaths: Array<string>) => {
  await Promise.resolve()
  return localPaths
}
