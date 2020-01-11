// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/fs'
import * as ChatTypes from '../constants/types/chat2'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'fs:'
export const acceptMacOSFuseExtClosedSource = 'fs:acceptMacOSFuseExtClosedSource'
export const cancelDownload = 'fs:cancelDownload'
export const commitEdit = 'fs:commitEdit'
export const copy = 'fs:copy'
export const deleteFile = 'fs:deleteFile'
export const discardEdit = 'fs:discardEdit'
export const dismissDownload = 'fs:dismissDownload'
export const dismissFsError = 'fs:dismissFsError'
export const download = 'fs:download'
export const driverDisable = 'fs:driverDisable'
export const driverDisabling = 'fs:driverDisabling'
export const driverEnable = 'fs:driverEnable'
export const driverKextPermissionError = 'fs:driverKextPermissionError'
export const editSuccess = 'fs:editSuccess'
export const favoriteIgnore = 'fs:favoriteIgnore'
export const favoriteIgnoreError = 'fs:favoriteIgnoreError'
export const favoritesLoad = 'fs:favoritesLoad'
export const favoritesLoaded = 'fs:favoritesLoaded'
export const finishManualConflictResolution = 'fs:finishManualConflictResolution'
export const finishedDownloadWithIntent = 'fs:finishedDownloadWithIntent'
export const finishedRegularDownload = 'fs:finishedRegularDownload'
export const folderListLoad = 'fs:folderListLoad'
export const folderListLoaded = 'fs:folderListLoaded'
export const fsError = 'fs:fsError'
export const getOnlineStatus = 'fs:getOnlineStatus'
export const initSendAttachmentToChat = 'fs:initSendAttachmentToChat'
export const journalUpdate = 'fs:journalUpdate'
export const kbfsDaemonOnlineStatusChanged = 'fs:kbfsDaemonOnlineStatusChanged'
export const kbfsDaemonRpcStatusChanged = 'fs:kbfsDaemonRpcStatusChanged'
export const letResetUserBackIn = 'fs:letResetUserBackIn'
export const loadAdditionalTlf = 'fs:loadAdditionalTlf'
export const loadDownloadInfo = 'fs:loadDownloadInfo'
export const loadDownloadStatus = 'fs:loadDownloadStatus'
export const loadFileContext = 'fs:loadFileContext'
export const loadFilesTabBadge = 'fs:loadFilesTabBadge'
export const loadPathInfo = 'fs:loadPathInfo'
export const loadPathMetadata = 'fs:loadPathMetadata'
export const loadSettings = 'fs:loadSettings'
export const loadTlfSyncConfig = 'fs:loadTlfSyncConfig'
export const loadedAdditionalTlf = 'fs:loadedAdditionalTlf'
export const loadedDownloadInfo = 'fs:loadedDownloadInfo'
export const loadedDownloadStatus = 'fs:loadedDownloadStatus'
export const loadedFileContext = 'fs:loadedFileContext'
export const loadedFilesTabBadge = 'fs:loadedFilesTabBadge'
export const loadedPathInfo = 'fs:loadedPathInfo'
export const move = 'fs:move'
export const newFolderName = 'fs:newFolderName'
export const newFolderRow = 'fs:newFolderRow'
export const openAndUpload = 'fs:openAndUpload'
export const openFilesFromWidget = 'fs:openFilesFromWidget'
export const openLocalPathInSystemFileManager = 'fs:openLocalPathInSystemFileManager'
export const openPathInSystemFileManager = 'fs:openPathInSystemFileManager'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const overallSyncStatusChanged = 'fs:overallSyncStatusChanged'
export const pathItemLoaded = 'fs:pathItemLoaded'
export const pickAndUpload = 'fs:pickAndUpload'
export const placeholderAction = 'fs:placeholderAction'
export const pollJournalStatus = 'fs:pollJournalStatus'
export const refreshDriverStatus = 'fs:refreshDriverStatus'
export const refreshMountDirsAfter10s = 'fs:refreshMountDirsAfter10s'
export const saveMedia = 'fs:saveMedia'
export const sentAttachmentToChat = 'fs:sentAttachmentToChat'
export const setDebugLevel = 'fs:setDebugLevel'
export const setDestinationPickerParentPath = 'fs:setDestinationPickerParentPath'
export const setDirectMountDir = 'fs:setDirectMountDir'
export const setDriverStatus = 'fs:setDriverStatus'
export const setFolderViewFilter = 'fs:setFolderViewFilter'
export const setIncomingShareLocalPath = 'fs:setIncomingShareLocalPath'
export const setLastPublicBannerClosedTlf = 'fs:setLastPublicBannerClosedTlf'
export const setMoveOrCopySource = 'fs:setMoveOrCopySource'
export const setPathItemActionMenuDownload = 'fs:setPathItemActionMenuDownload'
export const setPathItemActionMenuView = 'fs:setPathItemActionMenuView'
export const setPathSoftError = 'fs:setPathSoftError'
export const setPreferredMountDirs = 'fs:setPreferredMountDirs'
export const setSendAttachmentToChatConvID = 'fs:setSendAttachmentToChatConvID'
export const setSendAttachmentToChatFilter = 'fs:setSendAttachmentToChatFilter'
export const setSendAttachmentToChatTitle = 'fs:setSendAttachmentToChatTitle'
export const setSfmiBannerDismissed = 'fs:setSfmiBannerDismissed'
export const setSpaceAvailableNotificationThreshold = 'fs:setSpaceAvailableNotificationThreshold'
export const setTlfSoftError = 'fs:setTlfSoftError'
export const setTlfSyncConfig = 'fs:setTlfSyncConfig'
export const setTlfsAsUnloaded = 'fs:setTlfsAsUnloaded'
export const settingsLoaded = 'fs:settingsLoaded'
export const shareNative = 'fs:shareNative'
export const showHideDiskSpaceBanner = 'fs:showHideDiskSpaceBanner'
export const showIncomingShare = 'fs:showIncomingShare'
export const showMoveOrCopy = 'fs:showMoveOrCopy'
export const sortSetting = 'fs:sortSetting'
export const startManualConflictResolution = 'fs:startManualConflictResolution'
export const subscribeNonPath = 'fs:subscribeNonPath'
export const subscribePath = 'fs:subscribePath'
export const tlfSyncConfigLoaded = 'fs:tlfSyncConfigLoaded'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'
export const unsubscribe = 'fs:unsubscribe'
export const upload = 'fs:upload'
export const uploadStarted = 'fs:uploadStarted'
export const uploadWritingSuccess = 'fs:uploadWritingSuccess'
export const userFileEditsLoad = 'fs:userFileEditsLoad'
export const userFileEditsLoaded = 'fs:userFileEditsLoaded'
export const userIn = 'fs:userIn'
export const userOut = 'fs:userOut'
export const waitForKbfsDaemon = 'fs:waitForKbfsDaemon'

// Payload Types
type _AcceptMacOSFuseExtClosedSourcePayload = void
type _CancelDownloadPayload = {readonly downloadID: string}
type _CommitEditPayload = {readonly editID: Types.EditID}
type _CopyPayload = {readonly destinationParentPath: Types.Path}
type _DeleteFilePayload = {readonly path: Types.Path}
type _DiscardEditPayload = {readonly editID: Types.EditID}
type _DismissDownloadPayload = {readonly downloadID: string}
type _DismissFsErrorPayload = {readonly key: string}
type _DownloadPayload = {readonly path: Types.Path}
type _DriverDisablePayload = void
type _DriverDisablingPayload = void
type _DriverEnablePayload = {readonly isRetry?: boolean | null}
type _DriverKextPermissionErrorPayload = void
type _EditSuccessPayload = {readonly editID: Types.EditID; readonly parentPath: Types.Path}
type _FavoriteIgnoreErrorPayload = {readonly path: Types.Path; readonly error: Types.FsError}
type _FavoriteIgnorePayload = {readonly path: Types.Path}
type _FavoritesLoadPayload = void
type _FavoritesLoadedPayload = {
  readonly private: Types.TlfList
  readonly public: Types.TlfList
  readonly team: Types.TlfList
}
type _FinishManualConflictResolutionPayload = {readonly localViewTlfPath: Types.Path}
type _FinishedDownloadWithIntentPayload = {
  readonly downloadID: string
  readonly downloadIntent: Types.DownloadIntent
  readonly mimeType: string
}
type _FinishedRegularDownloadPayload = {readonly downloadID: string; readonly mimeType: string}
type _FolderListLoadPayload = {readonly recursive: boolean; readonly path: Types.Path}
type _FolderListLoadedPayload = {
  readonly path: Types.Path
  readonly pathItems: Map<Types.Path, Types.PathItem>
}
type _FsErrorPayload = {readonly error: Types.FsError; readonly expectedIfOffline: boolean}
type _GetOnlineStatusPayload = void
type _InitSendAttachmentToChatPayload = {readonly path: Types.Path}
type _JournalUpdatePayload = {
  readonly syncingPaths: Array<Types.Path>
  readonly totalSyncingBytes: number
  readonly endEstimate?: number | null
}
type _KbfsDaemonOnlineStatusChangedPayload = {readonly onlineStatus: RPCTypes.KbfsOnlineStatus}
type _KbfsDaemonRpcStatusChangedPayload = {readonly rpcStatus: Types.KbfsDaemonRpcStatus}
type _LetResetUserBackInPayload = {readonly id: RPCTypes.TeamID; readonly username: string}
type _LoadAdditionalTlfPayload = {readonly tlfPath: Types.Path}
type _LoadDownloadInfoPayload = {readonly downloadID: string}
type _LoadDownloadStatusPayload = void
type _LoadFileContextPayload = {readonly path: Types.Path}
type _LoadFilesTabBadgePayload = void
type _LoadPathInfoPayload = {readonly path: Types.Path}
type _LoadPathMetadataPayload = {readonly path: Types.Path}
type _LoadSettingsPayload = void
type _LoadTlfSyncConfigPayload = {readonly tlfPath: Types.Path}
type _LoadedAdditionalTlfPayload = {readonly tlf: Types.Tlf; readonly tlfPath: Types.Path}
type _LoadedDownloadInfoPayload = {readonly downloadID: string; readonly info: Types.DownloadInfo}
type _LoadedDownloadStatusPayload = {
  readonly regularDownloads: Array<string>
  readonly state: Map<string, Types.DownloadState>
}
type _LoadedFileContextPayload = {readonly path: Types.Path; readonly fileContext: Types.FileContext}
type _LoadedFilesTabBadgePayload = {readonly badge: RPCTypes.FilesTabBadge}
type _LoadedPathInfoPayload = {readonly path: Types.Path; readonly pathInfo: Types.PathInfo}
type _MovePayload = {readonly destinationParentPath: Types.Path}
type _NewFolderNamePayload = {readonly editID: Types.EditID; readonly name: string}
type _NewFolderRowPayload = {readonly parentPath: Types.Path}
type _OpenAndUploadPayload = {readonly type: Types.OpenDialogType; readonly parentPath: Types.Path}
type _OpenFilesFromWidgetPayload = {readonly path: Types.Path; readonly type: Types.PathType}
type _OpenLocalPathInSystemFileManagerPayload = {readonly localPath: string}
type _OpenPathInSystemFileManagerPayload = {readonly path: Types.Path}
type _OpenSecurityPreferencesPayload = void
type _OverallSyncStatusChangedPayload = {
  readonly progress: Types.SyncingFoldersProgress
  readonly diskSpaceStatus: Types.DiskSpaceStatus
}
type _PathItemLoadedPayload = {readonly path: Types.Path; readonly pathItem: Types.PathItem}
type _PickAndUploadPayload = {readonly type: Types.MobilePickType; readonly parentPath: Types.Path}
type _PlaceholderActionPayload = void
type _PollJournalStatusPayload = void
type _RefreshDriverStatusPayload = void
type _RefreshMountDirsAfter10sPayload = void
type _SaveMediaPayload = {readonly path: Types.Path}
type _SentAttachmentToChatPayload = void
type _SetDebugLevelPayload = {readonly level: string}
type _SetDestinationPickerParentPathPayload = {readonly index: number; readonly path: Types.Path}
type _SetDirectMountDirPayload = {readonly directMountDir: string}
type _SetDriverStatusPayload = {readonly driverStatus: Types.DriverStatus}
type _SetFolderViewFilterPayload = {readonly filter: string | null}
type _SetIncomingShareLocalPathPayload = {readonly localPath: Types.LocalPath}
type _SetLastPublicBannerClosedTlfPayload = {readonly tlf: string}
type _SetMoveOrCopySourcePayload = {readonly path: Types.Path}
type _SetPathItemActionMenuDownloadPayload = {
  readonly downloadID: string | null
  readonly intent: Types.DownloadIntent | null
}
type _SetPathItemActionMenuViewPayload = {readonly view: Types.PathItemActionMenuView}
type _SetPathSoftErrorPayload = {readonly path: Types.Path; readonly softError: Types.SoftError | null}
type _SetPreferredMountDirsPayload = {readonly preferredMountDirs: Array<string>}
type _SetSendAttachmentToChatConvIDPayload = {readonly convID: ChatTypes.ConversationIDKey}
type _SetSendAttachmentToChatFilterPayload = {readonly filter: string}
type _SetSendAttachmentToChatTitlePayload = {readonly title: string}
type _SetSfmiBannerDismissedPayload = {readonly dismissed: boolean}
type _SetSpaceAvailableNotificationThresholdPayload = {readonly spaceAvailableNotificationThreshold: number}
type _SetTlfSoftErrorPayload = {readonly path: Types.Path; readonly softError: Types.SoftError | null}
type _SetTlfSyncConfigPayload = {readonly enabled: boolean; readonly tlfPath: Types.Path}
type _SetTlfsAsUnloadedPayload = void
type _SettingsLoadedPayload = {readonly settings?: Types.Settings}
type _ShareNativePayload = {readonly path: Types.Path}
type _ShowHideDiskSpaceBannerPayload = {readonly show: boolean}
type _ShowIncomingSharePayload = {readonly initialDestinationParentPath: Types.Path}
type _ShowMoveOrCopyPayload = {readonly initialDestinationParentPath: Types.Path}
type _SortSettingPayload = {readonly path: Types.Path; readonly sortSetting: Types.SortSetting}
type _StartManualConflictResolutionPayload = {readonly tlfPath: Types.Path}
type _SubscribeNonPathPayload = {readonly subscriptionID: string; readonly topic: RPCTypes.SubscriptionTopic}
type _SubscribePathPayload = {
  readonly subscriptionID: string
  readonly path: Types.Path
  readonly topic: RPCTypes.PathSubscriptionTopic
}
type _TlfSyncConfigLoadedPayload = {
  readonly tlfType: Types.TlfType
  readonly tlfName: string
  readonly syncConfig: Types.TlfSyncConfig
}
type _UninstallKBFSConfirmPayload = void
type _UnsubscribePayload = {readonly subscriptionID: string}
type _UploadPayload = {readonly parentPath: Types.Path; readonly localPath: string}
type _UploadStartedPayload = {readonly path: Types.Path}
type _UploadWritingSuccessPayload = {readonly path: Types.Path}
type _UserFileEditsLoadPayload = void
type _UserFileEditsLoadedPayload = {readonly tlfUpdates: Types.UserTlfUpdates}
type _UserInPayload = void
type _UserOutPayload = void
type _WaitForKbfsDaemonPayload = void

// Action Creators
export const createAcceptMacOSFuseExtClosedSource = (
  payload: _AcceptMacOSFuseExtClosedSourcePayload
): AcceptMacOSFuseExtClosedSourcePayload => ({payload, type: acceptMacOSFuseExtClosedSource})
export const createCancelDownload = (payload: _CancelDownloadPayload): CancelDownloadPayload => ({
  payload,
  type: cancelDownload,
})
export const createCommitEdit = (payload: _CommitEditPayload): CommitEditPayload => ({
  payload,
  type: commitEdit,
})
export const createCopy = (payload: _CopyPayload): CopyPayload => ({payload, type: copy})
export const createDeleteFile = (payload: _DeleteFilePayload): DeleteFilePayload => ({
  payload,
  type: deleteFile,
})
export const createDiscardEdit = (payload: _DiscardEditPayload): DiscardEditPayload => ({
  payload,
  type: discardEdit,
})
export const createDismissDownload = (payload: _DismissDownloadPayload): DismissDownloadPayload => ({
  payload,
  type: dismissDownload,
})
export const createDismissFsError = (payload: _DismissFsErrorPayload): DismissFsErrorPayload => ({
  payload,
  type: dismissFsError,
})
export const createDownload = (payload: _DownloadPayload): DownloadPayload => ({payload, type: download})
export const createDriverDisable = (payload: _DriverDisablePayload): DriverDisablePayload => ({
  payload,
  type: driverDisable,
})
export const createDriverDisabling = (payload: _DriverDisablingPayload): DriverDisablingPayload => ({
  payload,
  type: driverDisabling,
})
export const createDriverEnable = (
  payload: _DriverEnablePayload = Object.freeze({})
): DriverEnablePayload => ({payload, type: driverEnable})
export const createDriverKextPermissionError = (
  payload: _DriverKextPermissionErrorPayload
): DriverKextPermissionErrorPayload => ({payload, type: driverKextPermissionError})
export const createEditSuccess = (payload: _EditSuccessPayload): EditSuccessPayload => ({
  payload,
  type: editSuccess,
})
export const createFavoriteIgnore = (payload: _FavoriteIgnorePayload): FavoriteIgnorePayload => ({
  payload,
  type: favoriteIgnore,
})
export const createFavoriteIgnoreError = (
  payload: _FavoriteIgnoreErrorPayload
): FavoriteIgnoreErrorPayload => ({payload, type: favoriteIgnoreError})
export const createFavoritesLoad = (payload: _FavoritesLoadPayload): FavoritesLoadPayload => ({
  payload,
  type: favoritesLoad,
})
export const createFavoritesLoaded = (payload: _FavoritesLoadedPayload): FavoritesLoadedPayload => ({
  payload,
  type: favoritesLoaded,
})
export const createFinishManualConflictResolution = (
  payload: _FinishManualConflictResolutionPayload
): FinishManualConflictResolutionPayload => ({payload, type: finishManualConflictResolution})
export const createFinishedDownloadWithIntent = (
  payload: _FinishedDownloadWithIntentPayload
): FinishedDownloadWithIntentPayload => ({payload, type: finishedDownloadWithIntent})
export const createFinishedRegularDownload = (
  payload: _FinishedRegularDownloadPayload
): FinishedRegularDownloadPayload => ({payload, type: finishedRegularDownload})
export const createFolderListLoad = (payload: _FolderListLoadPayload): FolderListLoadPayload => ({
  payload,
  type: folderListLoad,
})
export const createFolderListLoaded = (payload: _FolderListLoadedPayload): FolderListLoadedPayload => ({
  payload,
  type: folderListLoaded,
})
export const createFsError = (payload: _FsErrorPayload): FsErrorPayload => ({payload, type: fsError})
export const createGetOnlineStatus = (payload: _GetOnlineStatusPayload): GetOnlineStatusPayload => ({
  payload,
  type: getOnlineStatus,
})
export const createInitSendAttachmentToChat = (
  payload: _InitSendAttachmentToChatPayload
): InitSendAttachmentToChatPayload => ({payload, type: initSendAttachmentToChat})
export const createJournalUpdate = (payload: _JournalUpdatePayload): JournalUpdatePayload => ({
  payload,
  type: journalUpdate,
})
export const createKbfsDaemonOnlineStatusChanged = (
  payload: _KbfsDaemonOnlineStatusChangedPayload
): KbfsDaemonOnlineStatusChangedPayload => ({payload, type: kbfsDaemonOnlineStatusChanged})
export const createKbfsDaemonRpcStatusChanged = (
  payload: _KbfsDaemonRpcStatusChangedPayload
): KbfsDaemonRpcStatusChangedPayload => ({payload, type: kbfsDaemonRpcStatusChanged})
export const createLetResetUserBackIn = (payload: _LetResetUserBackInPayload): LetResetUserBackInPayload => ({
  payload,
  type: letResetUserBackIn,
})
export const createLoadAdditionalTlf = (payload: _LoadAdditionalTlfPayload): LoadAdditionalTlfPayload => ({
  payload,
  type: loadAdditionalTlf,
})
export const createLoadDownloadInfo = (payload: _LoadDownloadInfoPayload): LoadDownloadInfoPayload => ({
  payload,
  type: loadDownloadInfo,
})
export const createLoadDownloadStatus = (payload: _LoadDownloadStatusPayload): LoadDownloadStatusPayload => ({
  payload,
  type: loadDownloadStatus,
})
export const createLoadFileContext = (payload: _LoadFileContextPayload): LoadFileContextPayload => ({
  payload,
  type: loadFileContext,
})
export const createLoadFilesTabBadge = (payload: _LoadFilesTabBadgePayload): LoadFilesTabBadgePayload => ({
  payload,
  type: loadFilesTabBadge,
})
export const createLoadPathInfo = (payload: _LoadPathInfoPayload): LoadPathInfoPayload => ({
  payload,
  type: loadPathInfo,
})
export const createLoadPathMetadata = (payload: _LoadPathMetadataPayload): LoadPathMetadataPayload => ({
  payload,
  type: loadPathMetadata,
})
export const createLoadSettings = (payload: _LoadSettingsPayload): LoadSettingsPayload => ({
  payload,
  type: loadSettings,
})
export const createLoadTlfSyncConfig = (payload: _LoadTlfSyncConfigPayload): LoadTlfSyncConfigPayload => ({
  payload,
  type: loadTlfSyncConfig,
})
export const createLoadedAdditionalTlf = (
  payload: _LoadedAdditionalTlfPayload
): LoadedAdditionalTlfPayload => ({payload, type: loadedAdditionalTlf})
export const createLoadedDownloadInfo = (payload: _LoadedDownloadInfoPayload): LoadedDownloadInfoPayload => ({
  payload,
  type: loadedDownloadInfo,
})
export const createLoadedDownloadStatus = (
  payload: _LoadedDownloadStatusPayload
): LoadedDownloadStatusPayload => ({payload, type: loadedDownloadStatus})
export const createLoadedFileContext = (payload: _LoadedFileContextPayload): LoadedFileContextPayload => ({
  payload,
  type: loadedFileContext,
})
export const createLoadedFilesTabBadge = (
  payload: _LoadedFilesTabBadgePayload
): LoadedFilesTabBadgePayload => ({payload, type: loadedFilesTabBadge})
export const createLoadedPathInfo = (payload: _LoadedPathInfoPayload): LoadedPathInfoPayload => ({
  payload,
  type: loadedPathInfo,
})
export const createMove = (payload: _MovePayload): MovePayload => ({payload, type: move})
export const createNewFolderName = (payload: _NewFolderNamePayload): NewFolderNamePayload => ({
  payload,
  type: newFolderName,
})
export const createNewFolderRow = (payload: _NewFolderRowPayload): NewFolderRowPayload => ({
  payload,
  type: newFolderRow,
})
export const createOpenAndUpload = (payload: _OpenAndUploadPayload): OpenAndUploadPayload => ({
  payload,
  type: openAndUpload,
})
export const createOpenFilesFromWidget = (
  payload: _OpenFilesFromWidgetPayload
): OpenFilesFromWidgetPayload => ({payload, type: openFilesFromWidget})
export const createOpenLocalPathInSystemFileManager = (
  payload: _OpenLocalPathInSystemFileManagerPayload
): OpenLocalPathInSystemFileManagerPayload => ({payload, type: openLocalPathInSystemFileManager})
export const createOpenPathInSystemFileManager = (
  payload: _OpenPathInSystemFileManagerPayload
): OpenPathInSystemFileManagerPayload => ({payload, type: openPathInSystemFileManager})
export const createOpenSecurityPreferences = (
  payload: _OpenSecurityPreferencesPayload
): OpenSecurityPreferencesPayload => ({payload, type: openSecurityPreferences})
export const createOverallSyncStatusChanged = (
  payload: _OverallSyncStatusChangedPayload
): OverallSyncStatusChangedPayload => ({payload, type: overallSyncStatusChanged})
export const createPathItemLoaded = (payload: _PathItemLoadedPayload): PathItemLoadedPayload => ({
  payload,
  type: pathItemLoaded,
})
export const createPickAndUpload = (payload: _PickAndUploadPayload): PickAndUploadPayload => ({
  payload,
  type: pickAndUpload,
})
export const createPlaceholderAction = (payload: _PlaceholderActionPayload): PlaceholderActionPayload => ({
  payload,
  type: placeholderAction,
})
export const createPollJournalStatus = (payload: _PollJournalStatusPayload): PollJournalStatusPayload => ({
  payload,
  type: pollJournalStatus,
})
export const createRefreshDriverStatus = (
  payload: _RefreshDriverStatusPayload
): RefreshDriverStatusPayload => ({payload, type: refreshDriverStatus})
export const createRefreshMountDirsAfter10s = (
  payload: _RefreshMountDirsAfter10sPayload
): RefreshMountDirsAfter10sPayload => ({payload, type: refreshMountDirsAfter10s})
export const createSaveMedia = (payload: _SaveMediaPayload): SaveMediaPayload => ({payload, type: saveMedia})
export const createSentAttachmentToChat = (
  payload: _SentAttachmentToChatPayload
): SentAttachmentToChatPayload => ({payload, type: sentAttachmentToChat})
export const createSetDebugLevel = (payload: _SetDebugLevelPayload): SetDebugLevelPayload => ({
  payload,
  type: setDebugLevel,
})
export const createSetDestinationPickerParentPath = (
  payload: _SetDestinationPickerParentPathPayload
): SetDestinationPickerParentPathPayload => ({payload, type: setDestinationPickerParentPath})
export const createSetDirectMountDir = (payload: _SetDirectMountDirPayload): SetDirectMountDirPayload => ({
  payload,
  type: setDirectMountDir,
})
export const createSetDriverStatus = (payload: _SetDriverStatusPayload): SetDriverStatusPayload => ({
  payload,
  type: setDriverStatus,
})
export const createSetFolderViewFilter = (
  payload: _SetFolderViewFilterPayload
): SetFolderViewFilterPayload => ({payload, type: setFolderViewFilter})
export const createSetIncomingShareLocalPath = (
  payload: _SetIncomingShareLocalPathPayload
): SetIncomingShareLocalPathPayload => ({payload, type: setIncomingShareLocalPath})
export const createSetLastPublicBannerClosedTlf = (
  payload: _SetLastPublicBannerClosedTlfPayload
): SetLastPublicBannerClosedTlfPayload => ({payload, type: setLastPublicBannerClosedTlf})
export const createSetMoveOrCopySource = (
  payload: _SetMoveOrCopySourcePayload
): SetMoveOrCopySourcePayload => ({payload, type: setMoveOrCopySource})
export const createSetPathItemActionMenuDownload = (
  payload: _SetPathItemActionMenuDownloadPayload
): SetPathItemActionMenuDownloadPayload => ({payload, type: setPathItemActionMenuDownload})
export const createSetPathItemActionMenuView = (
  payload: _SetPathItemActionMenuViewPayload
): SetPathItemActionMenuViewPayload => ({payload, type: setPathItemActionMenuView})
export const createSetPathSoftError = (payload: _SetPathSoftErrorPayload): SetPathSoftErrorPayload => ({
  payload,
  type: setPathSoftError,
})
export const createSetPreferredMountDirs = (
  payload: _SetPreferredMountDirsPayload
): SetPreferredMountDirsPayload => ({payload, type: setPreferredMountDirs})
export const createSetSendAttachmentToChatConvID = (
  payload: _SetSendAttachmentToChatConvIDPayload
): SetSendAttachmentToChatConvIDPayload => ({payload, type: setSendAttachmentToChatConvID})
export const createSetSendAttachmentToChatFilter = (
  payload: _SetSendAttachmentToChatFilterPayload
): SetSendAttachmentToChatFilterPayload => ({payload, type: setSendAttachmentToChatFilter})
export const createSetSendAttachmentToChatTitle = (
  payload: _SetSendAttachmentToChatTitlePayload
): SetSendAttachmentToChatTitlePayload => ({payload, type: setSendAttachmentToChatTitle})
export const createSetSfmiBannerDismissed = (
  payload: _SetSfmiBannerDismissedPayload
): SetSfmiBannerDismissedPayload => ({payload, type: setSfmiBannerDismissed})
export const createSetSpaceAvailableNotificationThreshold = (
  payload: _SetSpaceAvailableNotificationThresholdPayload
): SetSpaceAvailableNotificationThresholdPayload => ({payload, type: setSpaceAvailableNotificationThreshold})
export const createSetTlfSoftError = (payload: _SetTlfSoftErrorPayload): SetTlfSoftErrorPayload => ({
  payload,
  type: setTlfSoftError,
})
export const createSetTlfSyncConfig = (payload: _SetTlfSyncConfigPayload): SetTlfSyncConfigPayload => ({
  payload,
  type: setTlfSyncConfig,
})
export const createSetTlfsAsUnloaded = (payload: _SetTlfsAsUnloadedPayload): SetTlfsAsUnloadedPayload => ({
  payload,
  type: setTlfsAsUnloaded,
})
export const createSettingsLoaded = (
  payload: _SettingsLoadedPayload = Object.freeze({})
): SettingsLoadedPayload => ({payload, type: settingsLoaded})
export const createShareNative = (payload: _ShareNativePayload): ShareNativePayload => ({
  payload,
  type: shareNative,
})
export const createShowHideDiskSpaceBanner = (
  payload: _ShowHideDiskSpaceBannerPayload
): ShowHideDiskSpaceBannerPayload => ({payload, type: showHideDiskSpaceBanner})
export const createShowIncomingShare = (payload: _ShowIncomingSharePayload): ShowIncomingSharePayload => ({
  payload,
  type: showIncomingShare,
})
export const createShowMoveOrCopy = (payload: _ShowMoveOrCopyPayload): ShowMoveOrCopyPayload => ({
  payload,
  type: showMoveOrCopy,
})
export const createSortSetting = (payload: _SortSettingPayload): SortSettingPayload => ({
  payload,
  type: sortSetting,
})
export const createStartManualConflictResolution = (
  payload: _StartManualConflictResolutionPayload
): StartManualConflictResolutionPayload => ({payload, type: startManualConflictResolution})
export const createSubscribeNonPath = (payload: _SubscribeNonPathPayload): SubscribeNonPathPayload => ({
  payload,
  type: subscribeNonPath,
})
export const createSubscribePath = (payload: _SubscribePathPayload): SubscribePathPayload => ({
  payload,
  type: subscribePath,
})
export const createTlfSyncConfigLoaded = (
  payload: _TlfSyncConfigLoadedPayload
): TlfSyncConfigLoadedPayload => ({payload, type: tlfSyncConfigLoaded})
export const createUninstallKBFSConfirm = (
  payload: _UninstallKBFSConfirmPayload
): UninstallKBFSConfirmPayload => ({payload, type: uninstallKBFSConfirm})
export const createUnsubscribe = (payload: _UnsubscribePayload): UnsubscribePayload => ({
  payload,
  type: unsubscribe,
})
export const createUpload = (payload: _UploadPayload): UploadPayload => ({payload, type: upload})
export const createUploadStarted = (payload: _UploadStartedPayload): UploadStartedPayload => ({
  payload,
  type: uploadStarted,
})
export const createUploadWritingSuccess = (
  payload: _UploadWritingSuccessPayload
): UploadWritingSuccessPayload => ({payload, type: uploadWritingSuccess})
export const createUserFileEditsLoad = (payload: _UserFileEditsLoadPayload): UserFileEditsLoadPayload => ({
  payload,
  type: userFileEditsLoad,
})
export const createUserFileEditsLoaded = (
  payload: _UserFileEditsLoadedPayload
): UserFileEditsLoadedPayload => ({payload, type: userFileEditsLoaded})
export const createUserIn = (payload: _UserInPayload): UserInPayload => ({payload, type: userIn})
export const createUserOut = (payload: _UserOutPayload): UserOutPayload => ({payload, type: userOut})
export const createWaitForKbfsDaemon = (payload: _WaitForKbfsDaemonPayload): WaitForKbfsDaemonPayload => ({
  payload,
  type: waitForKbfsDaemon,
})

// Action Payloads
export type AcceptMacOSFuseExtClosedSourcePayload = {
  readonly payload: _AcceptMacOSFuseExtClosedSourcePayload
  readonly type: typeof acceptMacOSFuseExtClosedSource
}
export type CancelDownloadPayload = {
  readonly payload: _CancelDownloadPayload
  readonly type: typeof cancelDownload
}
export type CommitEditPayload = {readonly payload: _CommitEditPayload; readonly type: typeof commitEdit}
export type CopyPayload = {readonly payload: _CopyPayload; readonly type: typeof copy}
export type DeleteFilePayload = {readonly payload: _DeleteFilePayload; readonly type: typeof deleteFile}
export type DiscardEditPayload = {readonly payload: _DiscardEditPayload; readonly type: typeof discardEdit}
export type DismissDownloadPayload = {
  readonly payload: _DismissDownloadPayload
  readonly type: typeof dismissDownload
}
export type DismissFsErrorPayload = {
  readonly payload: _DismissFsErrorPayload
  readonly type: typeof dismissFsError
}
export type DownloadPayload = {readonly payload: _DownloadPayload; readonly type: typeof download}
export type DriverDisablePayload = {
  readonly payload: _DriverDisablePayload
  readonly type: typeof driverDisable
}
export type DriverDisablingPayload = {
  readonly payload: _DriverDisablingPayload
  readonly type: typeof driverDisabling
}
export type DriverEnablePayload = {readonly payload: _DriverEnablePayload; readonly type: typeof driverEnable}
export type DriverKextPermissionErrorPayload = {
  readonly payload: _DriverKextPermissionErrorPayload
  readonly type: typeof driverKextPermissionError
}
export type EditSuccessPayload = {readonly payload: _EditSuccessPayload; readonly type: typeof editSuccess}
export type FavoriteIgnoreErrorPayload = {
  readonly payload: _FavoriteIgnoreErrorPayload
  readonly type: typeof favoriteIgnoreError
}
export type FavoriteIgnorePayload = {
  readonly payload: _FavoriteIgnorePayload
  readonly type: typeof favoriteIgnore
}
export type FavoritesLoadPayload = {
  readonly payload: _FavoritesLoadPayload
  readonly type: typeof favoritesLoad
}
export type FavoritesLoadedPayload = {
  readonly payload: _FavoritesLoadedPayload
  readonly type: typeof favoritesLoaded
}
export type FinishManualConflictResolutionPayload = {
  readonly payload: _FinishManualConflictResolutionPayload
  readonly type: typeof finishManualConflictResolution
}
export type FinishedDownloadWithIntentPayload = {
  readonly payload: _FinishedDownloadWithIntentPayload
  readonly type: typeof finishedDownloadWithIntent
}
export type FinishedRegularDownloadPayload = {
  readonly payload: _FinishedRegularDownloadPayload
  readonly type: typeof finishedRegularDownload
}
export type FolderListLoadPayload = {
  readonly payload: _FolderListLoadPayload
  readonly type: typeof folderListLoad
}
export type FolderListLoadedPayload = {
  readonly payload: _FolderListLoadedPayload
  readonly type: typeof folderListLoaded
}
export type FsErrorPayload = {readonly payload: _FsErrorPayload; readonly type: typeof fsError}
export type GetOnlineStatusPayload = {
  readonly payload: _GetOnlineStatusPayload
  readonly type: typeof getOnlineStatus
}
export type InitSendAttachmentToChatPayload = {
  readonly payload: _InitSendAttachmentToChatPayload
  readonly type: typeof initSendAttachmentToChat
}
export type JournalUpdatePayload = {
  readonly payload: _JournalUpdatePayload
  readonly type: typeof journalUpdate
}
export type KbfsDaemonOnlineStatusChangedPayload = {
  readonly payload: _KbfsDaemonOnlineStatusChangedPayload
  readonly type: typeof kbfsDaemonOnlineStatusChanged
}
export type KbfsDaemonRpcStatusChangedPayload = {
  readonly payload: _KbfsDaemonRpcStatusChangedPayload
  readonly type: typeof kbfsDaemonRpcStatusChanged
}
export type LetResetUserBackInPayload = {
  readonly payload: _LetResetUserBackInPayload
  readonly type: typeof letResetUserBackIn
}
export type LoadAdditionalTlfPayload = {
  readonly payload: _LoadAdditionalTlfPayload
  readonly type: typeof loadAdditionalTlf
}
export type LoadDownloadInfoPayload = {
  readonly payload: _LoadDownloadInfoPayload
  readonly type: typeof loadDownloadInfo
}
export type LoadDownloadStatusPayload = {
  readonly payload: _LoadDownloadStatusPayload
  readonly type: typeof loadDownloadStatus
}
export type LoadFileContextPayload = {
  readonly payload: _LoadFileContextPayload
  readonly type: typeof loadFileContext
}
export type LoadFilesTabBadgePayload = {
  readonly payload: _LoadFilesTabBadgePayload
  readonly type: typeof loadFilesTabBadge
}
export type LoadPathInfoPayload = {readonly payload: _LoadPathInfoPayload; readonly type: typeof loadPathInfo}
export type LoadPathMetadataPayload = {
  readonly payload: _LoadPathMetadataPayload
  readonly type: typeof loadPathMetadata
}
export type LoadSettingsPayload = {readonly payload: _LoadSettingsPayload; readonly type: typeof loadSettings}
export type LoadTlfSyncConfigPayload = {
  readonly payload: _LoadTlfSyncConfigPayload
  readonly type: typeof loadTlfSyncConfig
}
export type LoadedAdditionalTlfPayload = {
  readonly payload: _LoadedAdditionalTlfPayload
  readonly type: typeof loadedAdditionalTlf
}
export type LoadedDownloadInfoPayload = {
  readonly payload: _LoadedDownloadInfoPayload
  readonly type: typeof loadedDownloadInfo
}
export type LoadedDownloadStatusPayload = {
  readonly payload: _LoadedDownloadStatusPayload
  readonly type: typeof loadedDownloadStatus
}
export type LoadedFileContextPayload = {
  readonly payload: _LoadedFileContextPayload
  readonly type: typeof loadedFileContext
}
export type LoadedFilesTabBadgePayload = {
  readonly payload: _LoadedFilesTabBadgePayload
  readonly type: typeof loadedFilesTabBadge
}
export type LoadedPathInfoPayload = {
  readonly payload: _LoadedPathInfoPayload
  readonly type: typeof loadedPathInfo
}
export type MovePayload = {readonly payload: _MovePayload; readonly type: typeof move}
export type NewFolderNamePayload = {
  readonly payload: _NewFolderNamePayload
  readonly type: typeof newFolderName
}
export type NewFolderRowPayload = {readonly payload: _NewFolderRowPayload; readonly type: typeof newFolderRow}
export type OpenAndUploadPayload = {
  readonly payload: _OpenAndUploadPayload
  readonly type: typeof openAndUpload
}
export type OpenFilesFromWidgetPayload = {
  readonly payload: _OpenFilesFromWidgetPayload
  readonly type: typeof openFilesFromWidget
}
export type OpenLocalPathInSystemFileManagerPayload = {
  readonly payload: _OpenLocalPathInSystemFileManagerPayload
  readonly type: typeof openLocalPathInSystemFileManager
}
export type OpenPathInSystemFileManagerPayload = {
  readonly payload: _OpenPathInSystemFileManagerPayload
  readonly type: typeof openPathInSystemFileManager
}
export type OpenSecurityPreferencesPayload = {
  readonly payload: _OpenSecurityPreferencesPayload
  readonly type: typeof openSecurityPreferences
}
export type OverallSyncStatusChangedPayload = {
  readonly payload: _OverallSyncStatusChangedPayload
  readonly type: typeof overallSyncStatusChanged
}
export type PathItemLoadedPayload = {
  readonly payload: _PathItemLoadedPayload
  readonly type: typeof pathItemLoaded
}
export type PickAndUploadPayload = {
  readonly payload: _PickAndUploadPayload
  readonly type: typeof pickAndUpload
}
export type PlaceholderActionPayload = {
  readonly payload: _PlaceholderActionPayload
  readonly type: typeof placeholderAction
}
export type PollJournalStatusPayload = {
  readonly payload: _PollJournalStatusPayload
  readonly type: typeof pollJournalStatus
}
export type RefreshDriverStatusPayload = {
  readonly payload: _RefreshDriverStatusPayload
  readonly type: typeof refreshDriverStatus
}
export type RefreshMountDirsAfter10sPayload = {
  readonly payload: _RefreshMountDirsAfter10sPayload
  readonly type: typeof refreshMountDirsAfter10s
}
export type SaveMediaPayload = {readonly payload: _SaveMediaPayload; readonly type: typeof saveMedia}
export type SentAttachmentToChatPayload = {
  readonly payload: _SentAttachmentToChatPayload
  readonly type: typeof sentAttachmentToChat
}
export type SetDebugLevelPayload = {
  readonly payload: _SetDebugLevelPayload
  readonly type: typeof setDebugLevel
}
export type SetDestinationPickerParentPathPayload = {
  readonly payload: _SetDestinationPickerParentPathPayload
  readonly type: typeof setDestinationPickerParentPath
}
export type SetDirectMountDirPayload = {
  readonly payload: _SetDirectMountDirPayload
  readonly type: typeof setDirectMountDir
}
export type SetDriverStatusPayload = {
  readonly payload: _SetDriverStatusPayload
  readonly type: typeof setDriverStatus
}
export type SetFolderViewFilterPayload = {
  readonly payload: _SetFolderViewFilterPayload
  readonly type: typeof setFolderViewFilter
}
export type SetIncomingShareLocalPathPayload = {
  readonly payload: _SetIncomingShareLocalPathPayload
  readonly type: typeof setIncomingShareLocalPath
}
export type SetLastPublicBannerClosedTlfPayload = {
  readonly payload: _SetLastPublicBannerClosedTlfPayload
  readonly type: typeof setLastPublicBannerClosedTlf
}
export type SetMoveOrCopySourcePayload = {
  readonly payload: _SetMoveOrCopySourcePayload
  readonly type: typeof setMoveOrCopySource
}
export type SetPathItemActionMenuDownloadPayload = {
  readonly payload: _SetPathItemActionMenuDownloadPayload
  readonly type: typeof setPathItemActionMenuDownload
}
export type SetPathItemActionMenuViewPayload = {
  readonly payload: _SetPathItemActionMenuViewPayload
  readonly type: typeof setPathItemActionMenuView
}
export type SetPathSoftErrorPayload = {
  readonly payload: _SetPathSoftErrorPayload
  readonly type: typeof setPathSoftError
}
export type SetPreferredMountDirsPayload = {
  readonly payload: _SetPreferredMountDirsPayload
  readonly type: typeof setPreferredMountDirs
}
export type SetSendAttachmentToChatConvIDPayload = {
  readonly payload: _SetSendAttachmentToChatConvIDPayload
  readonly type: typeof setSendAttachmentToChatConvID
}
export type SetSendAttachmentToChatFilterPayload = {
  readonly payload: _SetSendAttachmentToChatFilterPayload
  readonly type: typeof setSendAttachmentToChatFilter
}
export type SetSendAttachmentToChatTitlePayload = {
  readonly payload: _SetSendAttachmentToChatTitlePayload
  readonly type: typeof setSendAttachmentToChatTitle
}
export type SetSfmiBannerDismissedPayload = {
  readonly payload: _SetSfmiBannerDismissedPayload
  readonly type: typeof setSfmiBannerDismissed
}
export type SetSpaceAvailableNotificationThresholdPayload = {
  readonly payload: _SetSpaceAvailableNotificationThresholdPayload
  readonly type: typeof setSpaceAvailableNotificationThreshold
}
export type SetTlfSoftErrorPayload = {
  readonly payload: _SetTlfSoftErrorPayload
  readonly type: typeof setTlfSoftError
}
export type SetTlfSyncConfigPayload = {
  readonly payload: _SetTlfSyncConfigPayload
  readonly type: typeof setTlfSyncConfig
}
export type SetTlfsAsUnloadedPayload = {
  readonly payload: _SetTlfsAsUnloadedPayload
  readonly type: typeof setTlfsAsUnloaded
}
export type SettingsLoadedPayload = {
  readonly payload: _SettingsLoadedPayload
  readonly type: typeof settingsLoaded
}
export type ShareNativePayload = {readonly payload: _ShareNativePayload; readonly type: typeof shareNative}
export type ShowHideDiskSpaceBannerPayload = {
  readonly payload: _ShowHideDiskSpaceBannerPayload
  readonly type: typeof showHideDiskSpaceBanner
}
export type ShowIncomingSharePayload = {
  readonly payload: _ShowIncomingSharePayload
  readonly type: typeof showIncomingShare
}
export type ShowMoveOrCopyPayload = {
  readonly payload: _ShowMoveOrCopyPayload
  readonly type: typeof showMoveOrCopy
}
export type SortSettingPayload = {readonly payload: _SortSettingPayload; readonly type: typeof sortSetting}
export type StartManualConflictResolutionPayload = {
  readonly payload: _StartManualConflictResolutionPayload
  readonly type: typeof startManualConflictResolution
}
export type SubscribeNonPathPayload = {
  readonly payload: _SubscribeNonPathPayload
  readonly type: typeof subscribeNonPath
}
export type SubscribePathPayload = {
  readonly payload: _SubscribePathPayload
  readonly type: typeof subscribePath
}
export type TlfSyncConfigLoadedPayload = {
  readonly payload: _TlfSyncConfigLoadedPayload
  readonly type: typeof tlfSyncConfigLoaded
}
export type UninstallKBFSConfirmPayload = {
  readonly payload: _UninstallKBFSConfirmPayload
  readonly type: typeof uninstallKBFSConfirm
}
export type UnsubscribePayload = {readonly payload: _UnsubscribePayload; readonly type: typeof unsubscribe}
export type UploadPayload = {readonly payload: _UploadPayload; readonly type: typeof upload}
export type UploadStartedPayload = {
  readonly payload: _UploadStartedPayload
  readonly type: typeof uploadStarted
}
export type UploadWritingSuccessPayload = {
  readonly payload: _UploadWritingSuccessPayload
  readonly type: typeof uploadWritingSuccess
}
export type UserFileEditsLoadPayload = {
  readonly payload: _UserFileEditsLoadPayload
  readonly type: typeof userFileEditsLoad
}
export type UserFileEditsLoadedPayload = {
  readonly payload: _UserFileEditsLoadedPayload
  readonly type: typeof userFileEditsLoaded
}
export type UserInPayload = {readonly payload: _UserInPayload; readonly type: typeof userIn}
export type UserOutPayload = {readonly payload: _UserOutPayload; readonly type: typeof userOut}
export type WaitForKbfsDaemonPayload = {
  readonly payload: _WaitForKbfsDaemonPayload
  readonly type: typeof waitForKbfsDaemon
}

// All Actions
// prettier-ignore
export type Actions =
  | AcceptMacOSFuseExtClosedSourcePayload
  | CancelDownloadPayload
  | CommitEditPayload
  | CopyPayload
  | DeleteFilePayload
  | DiscardEditPayload
  | DismissDownloadPayload
  | DismissFsErrorPayload
  | DownloadPayload
  | DriverDisablePayload
  | DriverDisablingPayload
  | DriverEnablePayload
  | DriverKextPermissionErrorPayload
  | EditSuccessPayload
  | FavoriteIgnoreErrorPayload
  | FavoriteIgnorePayload
  | FavoritesLoadPayload
  | FavoritesLoadedPayload
  | FinishManualConflictResolutionPayload
  | FinishedDownloadWithIntentPayload
  | FinishedRegularDownloadPayload
  | FolderListLoadPayload
  | FolderListLoadedPayload
  | FsErrorPayload
  | GetOnlineStatusPayload
  | InitSendAttachmentToChatPayload
  | JournalUpdatePayload
  | KbfsDaemonOnlineStatusChangedPayload
  | KbfsDaemonRpcStatusChangedPayload
  | LetResetUserBackInPayload
  | LoadAdditionalTlfPayload
  | LoadDownloadInfoPayload
  | LoadDownloadStatusPayload
  | LoadFileContextPayload
  | LoadFilesTabBadgePayload
  | LoadPathInfoPayload
  | LoadPathMetadataPayload
  | LoadSettingsPayload
  | LoadTlfSyncConfigPayload
  | LoadedAdditionalTlfPayload
  | LoadedDownloadInfoPayload
  | LoadedDownloadStatusPayload
  | LoadedFileContextPayload
  | LoadedFilesTabBadgePayload
  | LoadedPathInfoPayload
  | MovePayload
  | NewFolderNamePayload
  | NewFolderRowPayload
  | OpenAndUploadPayload
  | OpenFilesFromWidgetPayload
  | OpenLocalPathInSystemFileManagerPayload
  | OpenPathInSystemFileManagerPayload
  | OpenSecurityPreferencesPayload
  | OverallSyncStatusChangedPayload
  | PathItemLoadedPayload
  | PickAndUploadPayload
  | PlaceholderActionPayload
  | PollJournalStatusPayload
  | RefreshDriverStatusPayload
  | RefreshMountDirsAfter10sPayload
  | SaveMediaPayload
  | SentAttachmentToChatPayload
  | SetDebugLevelPayload
  | SetDestinationPickerParentPathPayload
  | SetDirectMountDirPayload
  | SetDriverStatusPayload
  | SetFolderViewFilterPayload
  | SetIncomingShareLocalPathPayload
  | SetLastPublicBannerClosedTlfPayload
  | SetMoveOrCopySourcePayload
  | SetPathItemActionMenuDownloadPayload
  | SetPathItemActionMenuViewPayload
  | SetPathSoftErrorPayload
  | SetPreferredMountDirsPayload
  | SetSendAttachmentToChatConvIDPayload
  | SetSendAttachmentToChatFilterPayload
  | SetSendAttachmentToChatTitlePayload
  | SetSfmiBannerDismissedPayload
  | SetSpaceAvailableNotificationThresholdPayload
  | SetTlfSoftErrorPayload
  | SetTlfSyncConfigPayload
  | SetTlfsAsUnloadedPayload
  | SettingsLoadedPayload
  | ShareNativePayload
  | ShowHideDiskSpaceBannerPayload
  | ShowIncomingSharePayload
  | ShowMoveOrCopyPayload
  | SortSettingPayload
  | StartManualConflictResolutionPayload
  | SubscribeNonPathPayload
  | SubscribePathPayload
  | TlfSyncConfigLoadedPayload
  | UninstallKBFSConfirmPayload
  | UnsubscribePayload
  | UploadPayload
  | UploadStartedPayload
  | UploadWritingSuccessPayload
  | UserFileEditsLoadPayload
  | UserFileEditsLoadedPayload
  | UserInPayload
  | UserOutPayload
  | WaitForKbfsDaemonPayload
  | {type: 'common:resetStore', payload: {}}
