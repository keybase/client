import type * as T from '@/constants/types'

export declare const fuseStatusToDriverStatus: (status?: T.RPCGen.FuseStatus) => T.FS.DriverStatus

export declare const openLocalPathInSystemFileManagerDesktop: (localPath: string) => Promise<void>

export declare const openPathInSystemFileManagerDesktop: (
  path: T.FS.Path,
  pathItems: T.FS.PathItems,
  driverStatus: T.FS.DriverStatus,
  directMountDir: string
) => Promise<void>

export declare const refreshDriverStatusDesktop: () => Promise<T.RPCGen.FuseStatus | undefined>

export declare const refreshMountDirsDesktop: () => Promise<{
  directMountDir: string
  preferredMountDirs: Array<string>
}>

export declare const setSfmiBannerDismissedDesktop: (dismissed: boolean) => Promise<void>

export declare const afterDriverEnabledDesktop: (
  isRetry: boolean
) => Promise<'kextPermissionError' | 'kextPermissionErrorRetry' | 'noop' | 'refresh'>

export declare const afterDriverDisableDesktop: (
  driverStatus: T.FS.DriverStatus
) => Promise<'disabling' | 'noop' | 'refresh'>

export declare const afterDriverDisablingDesktop: (driverStatus: T.FS.DriverStatus) => Promise<void>

export declare const openSecurityPreferencesDesktop: () => Promise<void>

export declare const selectFilesToUploadDesktop: (
  type: T.FS.OpenDialogType,
  parentPath: T.FS.Path
) => Promise<Array<string>>

export declare const uploadFromDragAndDropDesktop: (localPaths: Array<string>) => Promise<Array<string>>

export declare const pickAndUploadMobile: (
  type: T.FS.MobilePickType,
  parentPath: T.FS.Path,
  upload: (parentPath: T.FS.Path, localPath: string) => void
) => Promise<void>

export declare const pickDocumentsMobile: (
  parentPath: T.FS.Path,
  upload: (parentPath: T.FS.Path, localPath: string) => void
) => Promise<void>

export declare const finishedDownloadWithIntentMobile: (
  downloadState: T.FS.DownloadState,
  downloadIntent: T.FS.DownloadIntent,
  mimeType: string
) => Promise<void>

export declare const afterKbfsDaemonRpcStatusChangedMobile: () => Promise<void>

export declare const finishedRegularDownloadMobile: (
  downloadID: string,
  downloadState: T.FS.DownloadState,
  downloadInfo: T.FS.DownloadInfo,
  mimeType: string
) => Promise<void>
