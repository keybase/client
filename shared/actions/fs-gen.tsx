// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/fs'
import * as ChatTypes from '../constants/types/chat2'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'fs:'
export const cancelDownload = 'fs:cancelDownload'
export const clearRefreshTag = 'fs:clearRefreshTag'
export const closeDestinationPicker = 'fs:closeDestinationPicker'
export const commitEdit = 'fs:commitEdit'
export const copy = 'fs:copy'
export const deleteFile = 'fs:deleteFile'
export const discardEdit = 'fs:discardEdit'
export const dismissDownload = 'fs:dismissDownload'
export const dismissFsError = 'fs:dismissFsError'
export const download = 'fs:download'
export const downloadProgress = 'fs:downloadProgress'
export const downloadStarted = 'fs:downloadStarted'
export const downloadSuccess = 'fs:downloadSuccess'
export const driverDisable = 'fs:driverDisable'
export const driverDisabling = 'fs:driverDisabling'
export const driverEnable = 'fs:driverEnable'
export const driverKextPermissionError = 'fs:driverKextPermissionError'
export const editSuccess = 'fs:editSuccess'
export const favoriteIgnore = 'fs:favoriteIgnore'
export const favoriteIgnoreError = 'fs:favoriteIgnoreError'
export const favoritesLoad = 'fs:favoritesLoad'
export const favoritesLoaded = 'fs:favoritesLoaded'
export const folderListLoad = 'fs:folderListLoad'
export const folderListLoaded = 'fs:folderListLoaded'
export const fsError = 'fs:fsError'
export const hideDiskSpaceBanner = 'fs:hideDiskSpaceBanner'
export const hideSystemFileManagerIntegrationBanner = 'fs:hideSystemFileManagerIntegrationBanner'
export const initSendAttachmentToChat = 'fs:initSendAttachmentToChat'
export const initSendLinkToChat = 'fs:initSendLinkToChat'
export const journalUpdate = 'fs:journalUpdate'
export const kbfsDaemonOnlineStatusChanged = 'fs:kbfsDaemonOnlineStatusChanged'
export const kbfsDaemonRpcStatusChanged = 'fs:kbfsDaemonRpcStatusChanged'
export const letResetUserBackIn = 'fs:letResetUserBackIn'
export const loadPathMetadata = 'fs:loadPathMetadata'
export const loadSettings = 'fs:loadSettings'
export const loadTlfSyncConfig = 'fs:loadTlfSyncConfig'
export const loadingPath = 'fs:loadingPath'
export const localHTTPServerInfo = 'fs:localHTTPServerInfo'
export const move = 'fs:move'
export const newFolderName = 'fs:newFolderName'
export const newFolderRow = 'fs:newFolderRow'
export const notifyTlfUpdate = 'fs:notifyTlfUpdate'
export const openAndUpload = 'fs:openAndUpload'
export const openFilesFromWidget = 'fs:openFilesFromWidget'
export const openLocalPathInSystemFileManager = 'fs:openLocalPathInSystemFileManager'
export const openPathInSystemFileManager = 'fs:openPathInSystemFileManager'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const overallSyncStatusChanged = 'fs:overallSyncStatusChanged'
export const pathItemLoaded = 'fs:pathItemLoaded'
export const pickAndUpload = 'fs:pickAndUpload'
export const placeholderAction = 'fs:placeholderAction'
export const refreshDriverStatus = 'fs:refreshDriverStatus'
export const refreshLocalHTTPServerInfo = 'fs:refreshLocalHTTPServerInfo'
export const saveMedia = 'fs:saveMedia'
export const sentAttachmentToChat = 'fs:sentAttachmentToChat'
export const sentLinkToChat = 'fs:sentLinkToChat'
export const setDestinationPickerParentPath = 'fs:setDestinationPickerParentPath'
export const setDriverStatus = 'fs:setDriverStatus'
export const setFolderViewFilter = 'fs:setFolderViewFilter'
export const setIncomingShareLocalPath = 'fs:setIncomingShareLocalPath'
export const setLastPublicBannerClosedTlf = 'fs:setLastPublicBannerClosedTlf'
export const setMoveOrCopySource = 'fs:setMoveOrCopySource'
export const setPathItemActionMenuDownloadKey = 'fs:setPathItemActionMenuDownloadKey'
export const setPathItemActionMenuView = 'fs:setPathItemActionMenuView'
export const setPathSoftError = 'fs:setPathSoftError'
export const setSendAttachmentToChatConvID = 'fs:setSendAttachmentToChatConvID'
export const setSendAttachmentToChatFilter = 'fs:setSendAttachmentToChatFilter'
export const setSendLinkToChatChannels = 'fs:setSendLinkToChatChannels'
export const setSendLinkToChatConvID = 'fs:setSendLinkToChatConvID'
export const setSpaceAvailableNotificationThreshold = 'fs:setSpaceAvailableNotificationThreshold'
export const setTlfSoftError = 'fs:setTlfSoftError'
export const setTlfSyncConfig = 'fs:setTlfSyncConfig'
export const settingsLoaded = 'fs:settingsLoaded'
export const shareNative = 'fs:shareNative'
export const showIncomingShare = 'fs:showIncomingShare'
export const showMoveOrCopy = 'fs:showMoveOrCopy'
export const showSystemFileManagerIntegrationBanner = 'fs:showSystemFileManagerIntegrationBanner'
export const sortSetting = 'fs:sortSetting'
export const startManualConflictResolution = 'fs:startManualConflictResolution'
export const tlfCrStatusChanged = 'fs:tlfCrStatusChanged'
export const tlfSyncConfigLoaded = 'fs:tlfSyncConfigLoaded'
export const triggerSendLinkToChat = 'fs:triggerSendLinkToChat'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'
export const upload = 'fs:upload'
export const uploadStarted = 'fs:uploadStarted'
export const uploadWritingSuccess = 'fs:uploadWritingSuccess'
export const userFileEditsLoad = 'fs:userFileEditsLoad'
export const userFileEditsLoaded = 'fs:userFileEditsLoaded'
export const waitForKbfsDaemon = 'fs:waitForKbfsDaemon'

// Payload Types
type _CancelDownloadPayload = {readonly key: string}
type _ClearRefreshTagPayload = {readonly refreshTag: Types.RefreshTag}
type _CloseDestinationPickerPayload = void
type _CommitEditPayload = {readonly editID: Types.EditID}
type _CopyPayload = {readonly destinationParentPath: Types.Path}
type _DeleteFilePayload = {readonly path: Types.Path}
type _DiscardEditPayload = {readonly editID: Types.EditID}
type _DismissDownloadPayload = {readonly key: string}
type _DismissFsErrorPayload = {readonly key: string}
type _DownloadPayload = {readonly path: Types.Path; readonly key: string}
type _DownloadProgressPayload = {
  readonly key: string
  readonly completePortion: number
  readonly endEstimate?: number
}
type _DownloadStartedPayload = {
  readonly entryType?: Types.PathType
  readonly key: string
  readonly path: Types.Path
  readonly localPath: Types.LocalPath
  readonly intent: Types.DownloadIntent
  readonly opID: RPCTypes.OpID
}
type _DownloadSuccessPayload = {
  readonly intent: Types.DownloadIntent
  readonly key: string
  readonly mimeType: string
}
type _DriverDisablePayload = void
type _DriverDisablingPayload = void
type _DriverEnablePayload = {readonly isRetry?: boolean | null}
type _DriverKextPermissionErrorPayload = void
type _EditSuccessPayload = {readonly editID: Types.EditID; readonly parentPath: Types.Path}
type _FavoriteIgnoreErrorPayload = {readonly path: Types.Path; readonly error: Types.FsError}
type _FavoriteIgnorePayload = {readonly path: Types.Path}
type _FavoritesLoadPayload = void
type _FavoritesLoadedPayload = {
  readonly private: I.Map<string, Types.Tlf>
  readonly public: I.Map<string, Types.Tlf>
  readonly team: I.Map<string, Types.Tlf>
}
type _FolderListLoadPayload = {readonly path: Types.Path; readonly refreshTag?: Types.RefreshTag}
type _FolderListLoadedPayload = {
  readonly path: Types.Path
  readonly pathItems: I.Map<Types.Path, Types.PathItem>
}
type _FsErrorPayload = {readonly error: Types.FsError; readonly expectedIfOffline: boolean}
type _HideDiskSpaceBannerPayload = void
type _HideSystemFileManagerIntegrationBannerPayload = void
type _InitSendAttachmentToChatPayload = {readonly path: Types.Path}
type _InitSendLinkToChatPayload = {readonly path: Types.Path}
type _JournalUpdatePayload = {
  readonly syncingPaths: Array<Types.Path>
  readonly totalSyncingBytes: number
  readonly endEstimate?: number | null
}
type _KbfsDaemonOnlineStatusChangedPayload = {readonly online: boolean}
type _KbfsDaemonRpcStatusChangedPayload = {readonly rpcStatus: Types.KbfsDaemonRpcStatus}
type _LetResetUserBackInPayload = {readonly id: RPCTypes.TeamID; readonly username: string}
type _LoadPathMetadataPayload = {readonly path: Types.Path; readonly refreshTag?: Types.RefreshTag | null}
type _LoadSettingsPayload = void
type _LoadTlfSyncConfigPayload = {readonly tlfPath: Types.Path}
type _LoadingPathPayload = {readonly path: Types.Path; readonly id: string; readonly done: boolean}
type _LocalHTTPServerInfoPayload = {readonly address: string; readonly token: string}
type _MovePayload = {readonly destinationParentPath: Types.Path}
type _NewFolderNamePayload = {readonly editID: Types.EditID; readonly name: string}
type _NewFolderRowPayload = {readonly parentPath: Types.Path}
type _NotifyTlfUpdatePayload = {readonly tlfPath: Types.Path}
type _OpenAndUploadPayload = {readonly type: Types.OpenDialogType; readonly parentPath: Types.Path}
type _OpenFilesFromWidgetPayload = {readonly path: Types.Path; readonly type: Types.PathType}
type _OpenLocalPathInSystemFileManagerPayload = {readonly localPath: string}
type _OpenPathInSystemFileManagerPayload = {readonly path: Types.Path}
type _OpenSecurityPreferencesPayload = void
type _OverallSyncStatusChangedPayload = {
  readonly progress: Types.SyncingFoldersProgress
  readonly outOfSpace: boolean
}
type _PathItemLoadedPayload = {readonly path: Types.Path; readonly pathItem: Types.PathItem}
type _PickAndUploadPayload = {readonly type: Types.MobilePickType; readonly parentPath: Types.Path}
type _PlaceholderActionPayload = void
type _RefreshDriverStatusPayload = void
type _RefreshLocalHTTPServerInfoPayload = void
type _SaveMediaPayload = {readonly path: Types.Path; readonly key: string}
type _SentAttachmentToChatPayload = void
type _SentLinkToChatPayload = {readonly convID: ChatTypes.ConversationIDKey}
type _SetDestinationPickerParentPathPayload = {readonly index: number; readonly path: Types.Path}
type _SetDriverStatusPayload = {readonly driverStatus: Types.DriverStatus}
type _SetFolderViewFilterPayload = {readonly filter: string}
type _SetIncomingShareLocalPathPayload = {readonly localPath: Types.LocalPath}
type _SetLastPublicBannerClosedTlfPayload = {readonly tlf: string}
type _SetMoveOrCopySourcePayload = {readonly path: Types.Path}
type _SetPathItemActionMenuDownloadKeyPayload = {readonly key: string | null}
type _SetPathItemActionMenuViewPayload = {readonly view: Types.PathItemActionMenuView}
type _SetPathSoftErrorPayload = {readonly path: Types.Path; readonly softError: Types.SoftError | null}
type _SetSendAttachmentToChatConvIDPayload = {readonly convID: ChatTypes.ConversationIDKey}
type _SetSendAttachmentToChatFilterPayload = {readonly filter: string}
type _SetSendLinkToChatChannelsPayload = {readonly channels: I.Map<ChatTypes.ConversationIDKey, string>}
type _SetSendLinkToChatConvIDPayload = {readonly convID: ChatTypes.ConversationIDKey}
type _SetSpaceAvailableNotificationThresholdPayload = {readonly spaceAvailableNotificationThreshold: number}
type _SetTlfSoftErrorPayload = {readonly path: Types.Path; readonly softError: Types.SoftError | null}
type _SetTlfSyncConfigPayload = {readonly enabled: boolean; readonly tlfPath: Types.Path}
type _SettingsLoadedPayload = {readonly settings?: Types.Settings}
type _ShareNativePayload = {readonly path: Types.Path; readonly key: string}
type _ShowIncomingSharePayload = {readonly initialDestinationParentPath: Types.Path}
type _ShowMoveOrCopyPayload = {readonly initialDestinationParentPath: Types.Path}
type _ShowSystemFileManagerIntegrationBannerPayload = void
type _SortSettingPayload = {readonly path: Types.Path; readonly sortSetting: Types.SortSetting}
type _StartManualConflictResolutionPayload = {readonly tlfPath: Types.Path}
type _TlfCrStatusChangedPayload = {readonly status: Types.ConflictState; readonly tlfPath: Types.Path}
type _TlfSyncConfigLoadedPayload = {
  readonly tlfType: Types.TlfType
  readonly tlfName: string
  readonly syncConfig: Types.TlfSyncConfig
}
type _TriggerSendLinkToChatPayload = void
type _UninstallKBFSConfirmPayload = void
type _UploadPayload = {readonly parentPath: Types.Path; readonly localPath: string}
type _UploadStartedPayload = {readonly path: Types.Path}
type _UploadWritingSuccessPayload = {readonly path: Types.Path}
type _UserFileEditsLoadPayload = void
type _UserFileEditsLoadedPayload = {readonly tlfUpdates: Types.UserTlfUpdates}
type _WaitForKbfsDaemonPayload = void

// Action Creators
export const createCancelDownload = (payload: _CancelDownloadPayload): CancelDownloadPayload => ({
  payload,
  type: cancelDownload,
})
export const createClearRefreshTag = (payload: _ClearRefreshTagPayload): ClearRefreshTagPayload => ({
  payload,
  type: clearRefreshTag,
})
export const createCloseDestinationPicker = (
  payload: _CloseDestinationPickerPayload
): CloseDestinationPickerPayload => ({payload, type: closeDestinationPicker})
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
export const createDownloadProgress = (payload: _DownloadProgressPayload): DownloadProgressPayload => ({
  payload,
  type: downloadProgress,
})
export const createDownloadStarted = (payload: _DownloadStartedPayload): DownloadStartedPayload => ({
  payload,
  type: downloadStarted,
})
export const createDownloadSuccess = (payload: _DownloadSuccessPayload): DownloadSuccessPayload => ({
  payload,
  type: downloadSuccess,
})
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
export const createFolderListLoad = (payload: _FolderListLoadPayload): FolderListLoadPayload => ({
  payload,
  type: folderListLoad,
})
export const createFolderListLoaded = (payload: _FolderListLoadedPayload): FolderListLoadedPayload => ({
  payload,
  type: folderListLoaded,
})
export const createFsError = (payload: _FsErrorPayload): FsErrorPayload => ({payload, type: fsError})
export const createHideDiskSpaceBanner = (
  payload: _HideDiskSpaceBannerPayload
): HideDiskSpaceBannerPayload => ({payload, type: hideDiskSpaceBanner})
export const createHideSystemFileManagerIntegrationBanner = (
  payload: _HideSystemFileManagerIntegrationBannerPayload
): HideSystemFileManagerIntegrationBannerPayload => ({payload, type: hideSystemFileManagerIntegrationBanner})
export const createInitSendAttachmentToChat = (
  payload: _InitSendAttachmentToChatPayload
): InitSendAttachmentToChatPayload => ({payload, type: initSendAttachmentToChat})
export const createInitSendLinkToChat = (payload: _InitSendLinkToChatPayload): InitSendLinkToChatPayload => ({
  payload,
  type: initSendLinkToChat,
})
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
export const createLoadingPath = (payload: _LoadingPathPayload): LoadingPathPayload => ({
  payload,
  type: loadingPath,
})
export const createLocalHTTPServerInfo = (
  payload: _LocalHTTPServerInfoPayload
): LocalHTTPServerInfoPayload => ({payload, type: localHTTPServerInfo})
export const createMove = (payload: _MovePayload): MovePayload => ({payload, type: move})
export const createNewFolderName = (payload: _NewFolderNamePayload): NewFolderNamePayload => ({
  payload,
  type: newFolderName,
})
export const createNewFolderRow = (payload: _NewFolderRowPayload): NewFolderRowPayload => ({
  payload,
  type: newFolderRow,
})
export const createNotifyTlfUpdate = (payload: _NotifyTlfUpdatePayload): NotifyTlfUpdatePayload => ({
  payload,
  type: notifyTlfUpdate,
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
export const createRefreshDriverStatus = (
  payload: _RefreshDriverStatusPayload
): RefreshDriverStatusPayload => ({payload, type: refreshDriverStatus})
export const createRefreshLocalHTTPServerInfo = (
  payload: _RefreshLocalHTTPServerInfoPayload
): RefreshLocalHTTPServerInfoPayload => ({payload, type: refreshLocalHTTPServerInfo})
export const createSaveMedia = (payload: _SaveMediaPayload): SaveMediaPayload => ({payload, type: saveMedia})
export const createSentAttachmentToChat = (
  payload: _SentAttachmentToChatPayload
): SentAttachmentToChatPayload => ({payload, type: sentAttachmentToChat})
export const createSentLinkToChat = (payload: _SentLinkToChatPayload): SentLinkToChatPayload => ({
  payload,
  type: sentLinkToChat,
})
export const createSetDestinationPickerParentPath = (
  payload: _SetDestinationPickerParentPathPayload
): SetDestinationPickerParentPathPayload => ({payload, type: setDestinationPickerParentPath})
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
export const createSetPathItemActionMenuDownloadKey = (
  payload: _SetPathItemActionMenuDownloadKeyPayload
): SetPathItemActionMenuDownloadKeyPayload => ({payload, type: setPathItemActionMenuDownloadKey})
export const createSetPathItemActionMenuView = (
  payload: _SetPathItemActionMenuViewPayload
): SetPathItemActionMenuViewPayload => ({payload, type: setPathItemActionMenuView})
export const createSetPathSoftError = (payload: _SetPathSoftErrorPayload): SetPathSoftErrorPayload => ({
  payload,
  type: setPathSoftError,
})
export const createSetSendAttachmentToChatConvID = (
  payload: _SetSendAttachmentToChatConvIDPayload
): SetSendAttachmentToChatConvIDPayload => ({payload, type: setSendAttachmentToChatConvID})
export const createSetSendAttachmentToChatFilter = (
  payload: _SetSendAttachmentToChatFilterPayload
): SetSendAttachmentToChatFilterPayload => ({payload, type: setSendAttachmentToChatFilter})
export const createSetSendLinkToChatChannels = (
  payload: _SetSendLinkToChatChannelsPayload
): SetSendLinkToChatChannelsPayload => ({payload, type: setSendLinkToChatChannels})
export const createSetSendLinkToChatConvID = (
  payload: _SetSendLinkToChatConvIDPayload
): SetSendLinkToChatConvIDPayload => ({payload, type: setSendLinkToChatConvID})
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
export const createSettingsLoaded = (
  payload: _SettingsLoadedPayload = Object.freeze({})
): SettingsLoadedPayload => ({payload, type: settingsLoaded})
export const createShareNative = (payload: _ShareNativePayload): ShareNativePayload => ({
  payload,
  type: shareNative,
})
export const createShowIncomingShare = (payload: _ShowIncomingSharePayload): ShowIncomingSharePayload => ({
  payload,
  type: showIncomingShare,
})
export const createShowMoveOrCopy = (payload: _ShowMoveOrCopyPayload): ShowMoveOrCopyPayload => ({
  payload,
  type: showMoveOrCopy,
})
export const createShowSystemFileManagerIntegrationBanner = (
  payload: _ShowSystemFileManagerIntegrationBannerPayload
): ShowSystemFileManagerIntegrationBannerPayload => ({payload, type: showSystemFileManagerIntegrationBanner})
export const createSortSetting = (payload: _SortSettingPayload): SortSettingPayload => ({
  payload,
  type: sortSetting,
})
export const createStartManualConflictResolution = (
  payload: _StartManualConflictResolutionPayload
): StartManualConflictResolutionPayload => ({payload, type: startManualConflictResolution})
export const createTlfCrStatusChanged = (payload: _TlfCrStatusChangedPayload): TlfCrStatusChangedPayload => ({
  payload,
  type: tlfCrStatusChanged,
})
export const createTlfSyncConfigLoaded = (
  payload: _TlfSyncConfigLoadedPayload
): TlfSyncConfigLoadedPayload => ({payload, type: tlfSyncConfigLoaded})
export const createTriggerSendLinkToChat = (
  payload: _TriggerSendLinkToChatPayload
): TriggerSendLinkToChatPayload => ({payload, type: triggerSendLinkToChat})
export const createUninstallKBFSConfirm = (
  payload: _UninstallKBFSConfirmPayload
): UninstallKBFSConfirmPayload => ({payload, type: uninstallKBFSConfirm})
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
export const createWaitForKbfsDaemon = (payload: _WaitForKbfsDaemonPayload): WaitForKbfsDaemonPayload => ({
  payload,
  type: waitForKbfsDaemon,
})

// Action Payloads
export type CancelDownloadPayload = {
  readonly payload: _CancelDownloadPayload
  readonly type: 'fs:cancelDownload'
}
export type ClearRefreshTagPayload = {
  readonly payload: _ClearRefreshTagPayload
  readonly type: 'fs:clearRefreshTag'
}
export type CloseDestinationPickerPayload = {
  readonly payload: _CloseDestinationPickerPayload
  readonly type: 'fs:closeDestinationPicker'
}
export type CommitEditPayload = {readonly payload: _CommitEditPayload; readonly type: 'fs:commitEdit'}
export type CopyPayload = {readonly payload: _CopyPayload; readonly type: 'fs:copy'}
export type DeleteFilePayload = {readonly payload: _DeleteFilePayload; readonly type: 'fs:deleteFile'}
export type DiscardEditPayload = {readonly payload: _DiscardEditPayload; readonly type: 'fs:discardEdit'}
export type DismissDownloadPayload = {
  readonly payload: _DismissDownloadPayload
  readonly type: 'fs:dismissDownload'
}
export type DismissFsErrorPayload = {
  readonly payload: _DismissFsErrorPayload
  readonly type: 'fs:dismissFsError'
}
export type DownloadPayload = {readonly payload: _DownloadPayload; readonly type: 'fs:download'}
export type DownloadProgressPayload = {
  readonly payload: _DownloadProgressPayload
  readonly type: 'fs:downloadProgress'
}
export type DownloadStartedPayload = {
  readonly payload: _DownloadStartedPayload
  readonly type: 'fs:downloadStarted'
}
export type DownloadSuccessPayload = {
  readonly payload: _DownloadSuccessPayload
  readonly type: 'fs:downloadSuccess'
}
export type DriverDisablePayload = {
  readonly payload: _DriverDisablePayload
  readonly type: 'fs:driverDisable'
}
export type DriverDisablingPayload = {
  readonly payload: _DriverDisablingPayload
  readonly type: 'fs:driverDisabling'
}
export type DriverEnablePayload = {readonly payload: _DriverEnablePayload; readonly type: 'fs:driverEnable'}
export type DriverKextPermissionErrorPayload = {
  readonly payload: _DriverKextPermissionErrorPayload
  readonly type: 'fs:driverKextPermissionError'
}
export type EditSuccessPayload = {readonly payload: _EditSuccessPayload; readonly type: 'fs:editSuccess'}
export type FavoriteIgnoreErrorPayload = {
  readonly payload: _FavoriteIgnoreErrorPayload
  readonly type: 'fs:favoriteIgnoreError'
}
export type FavoriteIgnorePayload = {
  readonly payload: _FavoriteIgnorePayload
  readonly type: 'fs:favoriteIgnore'
}
export type FavoritesLoadPayload = {
  readonly payload: _FavoritesLoadPayload
  readonly type: 'fs:favoritesLoad'
}
export type FavoritesLoadedPayload = {
  readonly payload: _FavoritesLoadedPayload
  readonly type: 'fs:favoritesLoaded'
}
export type FolderListLoadPayload = {
  readonly payload: _FolderListLoadPayload
  readonly type: 'fs:folderListLoad'
}
export type FolderListLoadedPayload = {
  readonly payload: _FolderListLoadedPayload
  readonly type: 'fs:folderListLoaded'
}
export type FsErrorPayload = {readonly payload: _FsErrorPayload; readonly type: 'fs:fsError'}
export type HideDiskSpaceBannerPayload = {
  readonly payload: _HideDiskSpaceBannerPayload
  readonly type: 'fs:hideDiskSpaceBanner'
}
export type HideSystemFileManagerIntegrationBannerPayload = {
  readonly payload: _HideSystemFileManagerIntegrationBannerPayload
  readonly type: 'fs:hideSystemFileManagerIntegrationBanner'
}
export type InitSendAttachmentToChatPayload = {
  readonly payload: _InitSendAttachmentToChatPayload
  readonly type: 'fs:initSendAttachmentToChat'
}
export type InitSendLinkToChatPayload = {
  readonly payload: _InitSendLinkToChatPayload
  readonly type: 'fs:initSendLinkToChat'
}
export type JournalUpdatePayload = {
  readonly payload: _JournalUpdatePayload
  readonly type: 'fs:journalUpdate'
}
export type KbfsDaemonOnlineStatusChangedPayload = {
  readonly payload: _KbfsDaemonOnlineStatusChangedPayload
  readonly type: 'fs:kbfsDaemonOnlineStatusChanged'
}
export type KbfsDaemonRpcStatusChangedPayload = {
  readonly payload: _KbfsDaemonRpcStatusChangedPayload
  readonly type: 'fs:kbfsDaemonRpcStatusChanged'
}
export type LetResetUserBackInPayload = {
  readonly payload: _LetResetUserBackInPayload
  readonly type: 'fs:letResetUserBackIn'
}
export type LoadPathMetadataPayload = {
  readonly payload: _LoadPathMetadataPayload
  readonly type: 'fs:loadPathMetadata'
}
export type LoadSettingsPayload = {readonly payload: _LoadSettingsPayload; readonly type: 'fs:loadSettings'}
export type LoadTlfSyncConfigPayload = {
  readonly payload: _LoadTlfSyncConfigPayload
  readonly type: 'fs:loadTlfSyncConfig'
}
export type LoadingPathPayload = {readonly payload: _LoadingPathPayload; readonly type: 'fs:loadingPath'}
export type LocalHTTPServerInfoPayload = {
  readonly payload: _LocalHTTPServerInfoPayload
  readonly type: 'fs:localHTTPServerInfo'
}
export type MovePayload = {readonly payload: _MovePayload; readonly type: 'fs:move'}
export type NewFolderNamePayload = {
  readonly payload: _NewFolderNamePayload
  readonly type: 'fs:newFolderName'
}
export type NewFolderRowPayload = {readonly payload: _NewFolderRowPayload; readonly type: 'fs:newFolderRow'}
export type NotifyTlfUpdatePayload = {
  readonly payload: _NotifyTlfUpdatePayload
  readonly type: 'fs:notifyTlfUpdate'
}
export type OpenAndUploadPayload = {
  readonly payload: _OpenAndUploadPayload
  readonly type: 'fs:openAndUpload'
}
export type OpenFilesFromWidgetPayload = {
  readonly payload: _OpenFilesFromWidgetPayload
  readonly type: 'fs:openFilesFromWidget'
}
export type OpenLocalPathInSystemFileManagerPayload = {
  readonly payload: _OpenLocalPathInSystemFileManagerPayload
  readonly type: 'fs:openLocalPathInSystemFileManager'
}
export type OpenPathInSystemFileManagerPayload = {
  readonly payload: _OpenPathInSystemFileManagerPayload
  readonly type: 'fs:openPathInSystemFileManager'
}
export type OpenSecurityPreferencesPayload = {
  readonly payload: _OpenSecurityPreferencesPayload
  readonly type: 'fs:openSecurityPreferences'
}
export type OverallSyncStatusChangedPayload = {
  readonly payload: _OverallSyncStatusChangedPayload
  readonly type: 'fs:overallSyncStatusChanged'
}
export type PathItemLoadedPayload = {
  readonly payload: _PathItemLoadedPayload
  readonly type: 'fs:pathItemLoaded'
}
export type PickAndUploadPayload = {
  readonly payload: _PickAndUploadPayload
  readonly type: 'fs:pickAndUpload'
}
export type PlaceholderActionPayload = {
  readonly payload: _PlaceholderActionPayload
  readonly type: 'fs:placeholderAction'
}
export type RefreshDriverStatusPayload = {
  readonly payload: _RefreshDriverStatusPayload
  readonly type: 'fs:refreshDriverStatus'
}
export type RefreshLocalHTTPServerInfoPayload = {
  readonly payload: _RefreshLocalHTTPServerInfoPayload
  readonly type: 'fs:refreshLocalHTTPServerInfo'
}
export type SaveMediaPayload = {readonly payload: _SaveMediaPayload; readonly type: 'fs:saveMedia'}
export type SentAttachmentToChatPayload = {
  readonly payload: _SentAttachmentToChatPayload
  readonly type: 'fs:sentAttachmentToChat'
}
export type SentLinkToChatPayload = {
  readonly payload: _SentLinkToChatPayload
  readonly type: 'fs:sentLinkToChat'
}
export type SetDestinationPickerParentPathPayload = {
  readonly payload: _SetDestinationPickerParentPathPayload
  readonly type: 'fs:setDestinationPickerParentPath'
}
export type SetDriverStatusPayload = {
  readonly payload: _SetDriverStatusPayload
  readonly type: 'fs:setDriverStatus'
}
export type SetFolderViewFilterPayload = {
  readonly payload: _SetFolderViewFilterPayload
  readonly type: 'fs:setFolderViewFilter'
}
export type SetIncomingShareLocalPathPayload = {
  readonly payload: _SetIncomingShareLocalPathPayload
  readonly type: 'fs:setIncomingShareLocalPath'
}
export type SetLastPublicBannerClosedTlfPayload = {
  readonly payload: _SetLastPublicBannerClosedTlfPayload
  readonly type: 'fs:setLastPublicBannerClosedTlf'
}
export type SetMoveOrCopySourcePayload = {
  readonly payload: _SetMoveOrCopySourcePayload
  readonly type: 'fs:setMoveOrCopySource'
}
export type SetPathItemActionMenuDownloadKeyPayload = {
  readonly payload: _SetPathItemActionMenuDownloadKeyPayload
  readonly type: 'fs:setPathItemActionMenuDownloadKey'
}
export type SetPathItemActionMenuViewPayload = {
  readonly payload: _SetPathItemActionMenuViewPayload
  readonly type: 'fs:setPathItemActionMenuView'
}
export type SetPathSoftErrorPayload = {
  readonly payload: _SetPathSoftErrorPayload
  readonly type: 'fs:setPathSoftError'
}
export type SetSendAttachmentToChatConvIDPayload = {
  readonly payload: _SetSendAttachmentToChatConvIDPayload
  readonly type: 'fs:setSendAttachmentToChatConvID'
}
export type SetSendAttachmentToChatFilterPayload = {
  readonly payload: _SetSendAttachmentToChatFilterPayload
  readonly type: 'fs:setSendAttachmentToChatFilter'
}
export type SetSendLinkToChatChannelsPayload = {
  readonly payload: _SetSendLinkToChatChannelsPayload
  readonly type: 'fs:setSendLinkToChatChannels'
}
export type SetSendLinkToChatConvIDPayload = {
  readonly payload: _SetSendLinkToChatConvIDPayload
  readonly type: 'fs:setSendLinkToChatConvID'
}
export type SetSpaceAvailableNotificationThresholdPayload = {
  readonly payload: _SetSpaceAvailableNotificationThresholdPayload
  readonly type: 'fs:setSpaceAvailableNotificationThreshold'
}
export type SetTlfSoftErrorPayload = {
  readonly payload: _SetTlfSoftErrorPayload
  readonly type: 'fs:setTlfSoftError'
}
export type SetTlfSyncConfigPayload = {
  readonly payload: _SetTlfSyncConfigPayload
  readonly type: 'fs:setTlfSyncConfig'
}
export type SettingsLoadedPayload = {
  readonly payload: _SettingsLoadedPayload
  readonly type: 'fs:settingsLoaded'
}
export type ShareNativePayload = {readonly payload: _ShareNativePayload; readonly type: 'fs:shareNative'}
export type ShowIncomingSharePayload = {
  readonly payload: _ShowIncomingSharePayload
  readonly type: 'fs:showIncomingShare'
}
export type ShowMoveOrCopyPayload = {
  readonly payload: _ShowMoveOrCopyPayload
  readonly type: 'fs:showMoveOrCopy'
}
export type ShowSystemFileManagerIntegrationBannerPayload = {
  readonly payload: _ShowSystemFileManagerIntegrationBannerPayload
  readonly type: 'fs:showSystemFileManagerIntegrationBanner'
}
export type SortSettingPayload = {readonly payload: _SortSettingPayload; readonly type: 'fs:sortSetting'}
export type StartManualConflictResolutionPayload = {
  readonly payload: _StartManualConflictResolutionPayload
  readonly type: 'fs:startManualConflictResolution'
}
export type TlfCrStatusChangedPayload = {
  readonly payload: _TlfCrStatusChangedPayload
  readonly type: 'fs:tlfCrStatusChanged'
}
export type TlfSyncConfigLoadedPayload = {
  readonly payload: _TlfSyncConfigLoadedPayload
  readonly type: 'fs:tlfSyncConfigLoaded'
}
export type TriggerSendLinkToChatPayload = {
  readonly payload: _TriggerSendLinkToChatPayload
  readonly type: 'fs:triggerSendLinkToChat'
}
export type UninstallKBFSConfirmPayload = {
  readonly payload: _UninstallKBFSConfirmPayload
  readonly type: 'fs:uninstallKBFSConfirm'
}
export type UploadPayload = {readonly payload: _UploadPayload; readonly type: 'fs:upload'}
export type UploadStartedPayload = {
  readonly payload: _UploadStartedPayload
  readonly type: 'fs:uploadStarted'
}
export type UploadWritingSuccessPayload = {
  readonly payload: _UploadWritingSuccessPayload
  readonly type: 'fs:uploadWritingSuccess'
}
export type UserFileEditsLoadPayload = {
  readonly payload: _UserFileEditsLoadPayload
  readonly type: 'fs:userFileEditsLoad'
}
export type UserFileEditsLoadedPayload = {
  readonly payload: _UserFileEditsLoadedPayload
  readonly type: 'fs:userFileEditsLoaded'
}
export type WaitForKbfsDaemonPayload = {
  readonly payload: _WaitForKbfsDaemonPayload
  readonly type: 'fs:waitForKbfsDaemon'
}

// All Actions
// prettier-ignore
export type Actions =
  | CancelDownloadPayload
  | ClearRefreshTagPayload
  | CloseDestinationPickerPayload
  | CommitEditPayload
  | CopyPayload
  | DeleteFilePayload
  | DiscardEditPayload
  | DismissDownloadPayload
  | DismissFsErrorPayload
  | DownloadPayload
  | DownloadProgressPayload
  | DownloadStartedPayload
  | DownloadSuccessPayload
  | DriverDisablePayload
  | DriverDisablingPayload
  | DriverEnablePayload
  | DriverKextPermissionErrorPayload
  | EditSuccessPayload
  | FavoriteIgnoreErrorPayload
  | FavoriteIgnorePayload
  | FavoritesLoadPayload
  | FavoritesLoadedPayload
  | FolderListLoadPayload
  | FolderListLoadedPayload
  | FsErrorPayload
  | HideDiskSpaceBannerPayload
  | HideSystemFileManagerIntegrationBannerPayload
  | InitSendAttachmentToChatPayload
  | InitSendLinkToChatPayload
  | JournalUpdatePayload
  | KbfsDaemonOnlineStatusChangedPayload
  | KbfsDaemonRpcStatusChangedPayload
  | LetResetUserBackInPayload
  | LoadPathMetadataPayload
  | LoadSettingsPayload
  | LoadTlfSyncConfigPayload
  | LoadingPathPayload
  | LocalHTTPServerInfoPayload
  | MovePayload
  | NewFolderNamePayload
  | NewFolderRowPayload
  | NotifyTlfUpdatePayload
  | OpenAndUploadPayload
  | OpenFilesFromWidgetPayload
  | OpenLocalPathInSystemFileManagerPayload
  | OpenPathInSystemFileManagerPayload
  | OpenSecurityPreferencesPayload
  | OverallSyncStatusChangedPayload
  | PathItemLoadedPayload
  | PickAndUploadPayload
  | PlaceholderActionPayload
  | RefreshDriverStatusPayload
  | RefreshLocalHTTPServerInfoPayload
  | SaveMediaPayload
  | SentAttachmentToChatPayload
  | SentLinkToChatPayload
  | SetDestinationPickerParentPathPayload
  | SetDriverStatusPayload
  | SetFolderViewFilterPayload
  | SetIncomingShareLocalPathPayload
  | SetLastPublicBannerClosedTlfPayload
  | SetMoveOrCopySourcePayload
  | SetPathItemActionMenuDownloadKeyPayload
  | SetPathItemActionMenuViewPayload
  | SetPathSoftErrorPayload
  | SetSendAttachmentToChatConvIDPayload
  | SetSendAttachmentToChatFilterPayload
  | SetSendLinkToChatChannelsPayload
  | SetSendLinkToChatConvIDPayload
  | SetSpaceAvailableNotificationThresholdPayload
  | SetTlfSoftErrorPayload
  | SetTlfSyncConfigPayload
  | SettingsLoadedPayload
  | ShareNativePayload
  | ShowIncomingSharePayload
  | ShowMoveOrCopyPayload
  | ShowSystemFileManagerIntegrationBannerPayload
  | SortSettingPayload
  | StartManualConflictResolutionPayload
  | TlfCrStatusChangedPayload
  | TlfSyncConfigLoadedPayload
  | TriggerSendLinkToChatPayload
  | UninstallKBFSConfirmPayload
  | UploadPayload
  | UploadStartedPayload
  | UploadWritingSuccessPayload
  | UserFileEditsLoadPayload
  | UserFileEditsLoadedPayload
  | WaitForKbfsDaemonPayload
  | {type: 'common:resetStore', payload: null}
