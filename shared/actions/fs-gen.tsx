// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/fs'
import * as ChatTypes from '../constants/types/chat2'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'fs:'
export const cancelDownload = 'fs:cancelDownload'
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
export const finishManualConflictResolution = 'fs:finishManualConflictResolution'
export const folderListLoad = 'fs:folderListLoad'
export const folderListLoaded = 'fs:folderListLoaded'
export const fsError = 'fs:fsError'
export const getOnlineStatus = 'fs:getOnlineStatus'
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
export const localHTTPServerInfo = 'fs:localHTTPServerInfo'
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
export const refreshLocalHTTPServerInfo = 'fs:refreshLocalHTTPServerInfo'
export const saveMedia = 'fs:saveMedia'
export const sentAttachmentToChat = 'fs:sentAttachmentToChat'
export const sentLinkToChat = 'fs:sentLinkToChat'
export const setDebugLevel = 'fs:setDebugLevel'
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
export const setSendAttachmentToChatTitle = 'fs:setSendAttachmentToChatTitle'
export const setSendLinkToChatChannels = 'fs:setSendLinkToChatChannels'
export const setSendLinkToChatConvID = 'fs:setSendLinkToChatConvID'
export const setSpaceAvailableNotificationThreshold = 'fs:setSpaceAvailableNotificationThreshold'
export const setTlfSoftError = 'fs:setTlfSoftError'
export const setTlfSyncConfig = 'fs:setTlfSyncConfig'
export const setTlfsAsUnloaded = 'fs:setTlfsAsUnloaded'
export const settingsLoaded = 'fs:settingsLoaded'
export const shareNative = 'fs:shareNative'
export const showHideDiskSpaceBanner = 'fs:showHideDiskSpaceBanner'
export const showIncomingShare = 'fs:showIncomingShare'
export const showMoveOrCopy = 'fs:showMoveOrCopy'
export const showSystemFileManagerIntegrationBanner = 'fs:showSystemFileManagerIntegrationBanner'
export const sortSetting = 'fs:sortSetting'
export const startManualConflictResolution = 'fs:startManualConflictResolution'
export const subscribeNonPath = 'fs:subscribeNonPath'
export const subscribePath = 'fs:subscribePath'
export const tlfSyncConfigLoaded = 'fs:tlfSyncConfigLoaded'
export const triggerSendLinkToChat = 'fs:triggerSendLinkToChat'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'
export const unsubscribe = 'fs:unsubscribe'
export const upload = 'fs:upload'
export const uploadStarted = 'fs:uploadStarted'
export const uploadWritingSuccess = 'fs:uploadWritingSuccess'
export const userFileEditsLoad = 'fs:userFileEditsLoad'
export const userFileEditsLoaded = 'fs:userFileEditsLoaded'
export const waitForKbfsDaemon = 'fs:waitForKbfsDaemon'

// Payload Types
type _CancelDownloadPayload = {readonly key: string}
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
type _FinishManualConflictResolutionPayload = {readonly localViewTlfPath: Types.Path}
type _FolderListLoadPayload = {readonly path: Types.Path}
type _FolderListLoadedPayload = {
  readonly path: Types.Path
  readonly pathItems: I.Map<Types.Path, Types.PathItem>
}
type _FsErrorPayload = {readonly error: Types.FsError; readonly expectedIfOffline: boolean}
type _GetOnlineStatusPayload = void
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
type _LoadPathMetadataPayload = {readonly path: Types.Path}
type _LoadSettingsPayload = void
type _LoadTlfSyncConfigPayload = {readonly tlfPath: Types.Path}
type _LocalHTTPServerInfoPayload = {readonly address: string; readonly token: string}
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
type _RefreshLocalHTTPServerInfoPayload = void
type _SaveMediaPayload = {readonly path: Types.Path; readonly key: string}
type _SentAttachmentToChatPayload = void
type _SentLinkToChatPayload = {readonly convID: ChatTypes.ConversationIDKey}
type _SetDebugLevelPayload = {readonly level: string}
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
type _SetSendAttachmentToChatTitlePayload = {readonly title: string}
type _SetSendLinkToChatChannelsPayload = {readonly channels: I.Map<ChatTypes.ConversationIDKey, string>}
type _SetSendLinkToChatConvIDPayload = {readonly convID: ChatTypes.ConversationIDKey}
type _SetSpaceAvailableNotificationThresholdPayload = {readonly spaceAvailableNotificationThreshold: number}
type _SetTlfSoftErrorPayload = {readonly path: Types.Path; readonly softError: Types.SoftError | null}
type _SetTlfSyncConfigPayload = {readonly enabled: boolean; readonly tlfPath: Types.Path}
type _SetTlfsAsUnloadedPayload = void
type _SettingsLoadedPayload = {readonly settings?: Types.Settings}
type _ShareNativePayload = {readonly path: Types.Path; readonly key: string}
type _ShowHideDiskSpaceBannerPayload = {readonly show: boolean}
type _ShowIncomingSharePayload = {readonly initialDestinationParentPath: Types.Path}
type _ShowMoveOrCopyPayload = {readonly initialDestinationParentPath: Types.Path}
type _ShowSystemFileManagerIntegrationBannerPayload = void
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
type _TriggerSendLinkToChatPayload = void
type _UninstallKBFSConfirmPayload = void
type _UnsubscribePayload = {readonly subscriptionID: string}
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
export const createFinishManualConflictResolution = (
  payload: _FinishManualConflictResolutionPayload
): FinishManualConflictResolutionPayload => ({payload, type: finishManualConflictResolution})
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
export const createSetDebugLevel = (payload: _SetDebugLevelPayload): SetDebugLevelPayload => ({
  payload,
  type: setDebugLevel,
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
export const createSetSendAttachmentToChatTitle = (
  payload: _SetSendAttachmentToChatTitlePayload
): SetSendAttachmentToChatTitlePayload => ({payload, type: setSendAttachmentToChatTitle})
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
export const createTriggerSendLinkToChat = (
  payload: _TriggerSendLinkToChatPayload
): TriggerSendLinkToChatPayload => ({payload, type: triggerSendLinkToChat})
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
export const createWaitForKbfsDaemon = (payload: _WaitForKbfsDaemonPayload): WaitForKbfsDaemonPayload => ({
  payload,
  type: waitForKbfsDaemon,
})

// Action Payloads
export type CancelDownloadPayload = {
  readonly payload: _CancelDownloadPayload
  readonly type: typeof cancelDownload
}
export type CloseDestinationPickerPayload = {
  readonly payload: _CloseDestinationPickerPayload
  readonly type: typeof closeDestinationPicker
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
export type DownloadProgressPayload = {
  readonly payload: _DownloadProgressPayload
  readonly type: typeof downloadProgress
}
export type DownloadStartedPayload = {
  readonly payload: _DownloadStartedPayload
  readonly type: typeof downloadStarted
}
export type DownloadSuccessPayload = {
  readonly payload: _DownloadSuccessPayload
  readonly type: typeof downloadSuccess
}
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
export type HideSystemFileManagerIntegrationBannerPayload = {
  readonly payload: _HideSystemFileManagerIntegrationBannerPayload
  readonly type: typeof hideSystemFileManagerIntegrationBanner
}
export type InitSendAttachmentToChatPayload = {
  readonly payload: _InitSendAttachmentToChatPayload
  readonly type: typeof initSendAttachmentToChat
}
export type InitSendLinkToChatPayload = {
  readonly payload: _InitSendLinkToChatPayload
  readonly type: typeof initSendLinkToChat
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
export type LoadPathMetadataPayload = {
  readonly payload: _LoadPathMetadataPayload
  readonly type: typeof loadPathMetadata
}
export type LoadSettingsPayload = {readonly payload: _LoadSettingsPayload; readonly type: typeof loadSettings}
export type LoadTlfSyncConfigPayload = {
  readonly payload: _LoadTlfSyncConfigPayload
  readonly type: typeof loadTlfSyncConfig
}
export type LocalHTTPServerInfoPayload = {
  readonly payload: _LocalHTTPServerInfoPayload
  readonly type: typeof localHTTPServerInfo
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
export type RefreshLocalHTTPServerInfoPayload = {
  readonly payload: _RefreshLocalHTTPServerInfoPayload
  readonly type: typeof refreshLocalHTTPServerInfo
}
export type SaveMediaPayload = {readonly payload: _SaveMediaPayload; readonly type: typeof saveMedia}
export type SentAttachmentToChatPayload = {
  readonly payload: _SentAttachmentToChatPayload
  readonly type: typeof sentAttachmentToChat
}
export type SentLinkToChatPayload = {
  readonly payload: _SentLinkToChatPayload
  readonly type: typeof sentLinkToChat
}
export type SetDebugLevelPayload = {
  readonly payload: _SetDebugLevelPayload
  readonly type: typeof setDebugLevel
}
export type SetDestinationPickerParentPathPayload = {
  readonly payload: _SetDestinationPickerParentPathPayload
  readonly type: typeof setDestinationPickerParentPath
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
export type SetPathItemActionMenuDownloadKeyPayload = {
  readonly payload: _SetPathItemActionMenuDownloadKeyPayload
  readonly type: typeof setPathItemActionMenuDownloadKey
}
export type SetPathItemActionMenuViewPayload = {
  readonly payload: _SetPathItemActionMenuViewPayload
  readonly type: typeof setPathItemActionMenuView
}
export type SetPathSoftErrorPayload = {
  readonly payload: _SetPathSoftErrorPayload
  readonly type: typeof setPathSoftError
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
export type SetSendLinkToChatChannelsPayload = {
  readonly payload: _SetSendLinkToChatChannelsPayload
  readonly type: typeof setSendLinkToChatChannels
}
export type SetSendLinkToChatConvIDPayload = {
  readonly payload: _SetSendLinkToChatConvIDPayload
  readonly type: typeof setSendLinkToChatConvID
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
export type ShowSystemFileManagerIntegrationBannerPayload = {
  readonly payload: _ShowSystemFileManagerIntegrationBannerPayload
  readonly type: typeof showSystemFileManagerIntegrationBanner
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
export type TriggerSendLinkToChatPayload = {
  readonly payload: _TriggerSendLinkToChatPayload
  readonly type: typeof triggerSendLinkToChat
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
export type WaitForKbfsDaemonPayload = {
  readonly payload: _WaitForKbfsDaemonPayload
  readonly type: typeof waitForKbfsDaemon
}

// All Actions
// prettier-ignore
export type Actions =
  | CancelDownloadPayload
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
  | FinishManualConflictResolutionPayload
  | FolderListLoadPayload
  | FolderListLoadedPayload
  | FsErrorPayload
  | GetOnlineStatusPayload
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
  | LocalHTTPServerInfoPayload
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
  | RefreshLocalHTTPServerInfoPayload
  | SaveMediaPayload
  | SentAttachmentToChatPayload
  | SentLinkToChatPayload
  | SetDebugLevelPayload
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
  | SetSendAttachmentToChatTitlePayload
  | SetSendLinkToChatChannelsPayload
  | SetSendLinkToChatConvIDPayload
  | SetSpaceAvailableNotificationThresholdPayload
  | SetTlfSoftErrorPayload
  | SetTlfSyncConfigPayload
  | SetTlfsAsUnloadedPayload
  | SettingsLoadedPayload
  | ShareNativePayload
  | ShowHideDiskSpaceBannerPayload
  | ShowIncomingSharePayload
  | ShowMoveOrCopyPayload
  | ShowSystemFileManagerIntegrationBannerPayload
  | SortSettingPayload
  | StartManualConflictResolutionPayload
  | SubscribeNonPathPayload
  | SubscribePathPayload
  | TlfSyncConfigLoadedPayload
  | TriggerSendLinkToChatPayload
  | UninstallKBFSConfirmPayload
  | UnsubscribePayload
  | UploadPayload
  | UploadStartedPayload
  | UploadWritingSuccessPayload
  | UserFileEditsLoadPayload
  | UserFileEditsLoadedPayload
  | WaitForKbfsDaemonPayload
  | {type: 'common:resetStore', payload: {}}
