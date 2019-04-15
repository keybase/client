// @flow
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
export const hideSystemFileManagerIntegrationBanner = 'fs:hideSystemFileManagerIntegrationBanner'
export const initSendAttachmentToChat = 'fs:initSendAttachmentToChat'
export const initSendLinkToChat = 'fs:initSendLinkToChat'
export const journalUpdate = 'fs:journalUpdate'
export const kbfsDaemonOnlineStatusChanged = 'fs:kbfsDaemonOnlineStatusChanged'
export const kbfsDaemonRpcStatusChanged = 'fs:kbfsDaemonRpcStatusChanged'
export const letResetUserBackIn = 'fs:letResetUserBackIn'
export const loadPathMetadata = 'fs:loadPathMetadata'
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
export const setMoveOrCopySource = 'fs:setMoveOrCopySource'
export const setPathItemActionMenuDownloadKey = 'fs:setPathItemActionMenuDownloadKey'
export const setPathItemActionMenuView = 'fs:setPathItemActionMenuView'
export const setSendAttachmentToChatConvID = 'fs:setSendAttachmentToChatConvID'
export const setSendAttachmentToChatFilter = 'fs:setSendAttachmentToChatFilter'
export const setSendLinkToChatChannels = 'fs:setSendLinkToChatChannels'
export const setSendLinkToChatConvID = 'fs:setSendLinkToChatConvID'
export const setTlfSyncConfig = 'fs:setTlfSyncConfig'
export const shareNative = 'fs:shareNative'
export const showIncomingShare = 'fs:showIncomingShare'
export const showMoveOrCopy = 'fs:showMoveOrCopy'
export const showSystemFileManagerIntegrationBanner = 'fs:showSystemFileManagerIntegrationBanner'
export const sortSetting = 'fs:sortSetting'
export const tlfSyncConfigLoaded = 'fs:tlfSyncConfigLoaded'
export const tlfSyncConfigsLoaded = 'fs:tlfSyncConfigsLoaded'
export const triggerSendLinkToChat = 'fs:triggerSendLinkToChat'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'
export const upload = 'fs:upload'
export const uploadStarted = 'fs:uploadStarted'
export const uploadWritingSuccess = 'fs:uploadWritingSuccess'
export const userFileEditsLoad = 'fs:userFileEditsLoad'
export const userFileEditsLoaded = 'fs:userFileEditsLoaded'
export const waitForKbfsDaemon = 'fs:waitForKbfsDaemon'

// Payload Types
type _CancelDownloadPayload = $ReadOnly<{|key: string|}>
type _ClearRefreshTagPayload = $ReadOnly<{|refreshTag: Types.RefreshTag|}>
type _CloseDestinationPickerPayload = void
type _CommitEditPayload = $ReadOnly<{|editID: Types.EditID|}>
type _CopyPayload = $ReadOnly<{|destinationParentPath: Types.Path|}>
type _DeleteFilePayload = $ReadOnly<{|path: Types.Path|}>
type _DiscardEditPayload = $ReadOnly<{|editID: Types.EditID|}>
type _DismissDownloadPayload = $ReadOnly<{|key: string|}>
type _DismissFsErrorPayload = $ReadOnly<{|key: string|}>
type _DownloadPayload = $ReadOnly<{|path: Types.Path, key: string|}>
type _DownloadProgressPayload = $ReadOnly<{|key: string, completePortion: number, endEstimate?: number|}>
type _DownloadStartedPayload = $ReadOnly<{|entryType?: Types.PathType, key: string, path: Types.Path, localPath: Types.LocalPath, intent: Types.DownloadIntent, opID: RPCTypes.OpID|}>
type _DownloadSuccessPayload = $ReadOnly<{|intent: Types.DownloadIntent, key: string, mimeType: string|}>
type _DriverDisablePayload = void
type _DriverEnablePayload = $ReadOnly<{|isRetry?: ?boolean|}>
type _DriverKextPermissionErrorPayload = void
type _EditSuccessPayload = $ReadOnly<{|editID: Types.EditID, parentPath: Types.Path|}>
type _FavoriteIgnoreErrorPayload = $ReadOnly<{|path: Types.Path, error: Types.FsError|}>
type _FavoriteIgnorePayload = $ReadOnly<{|path: Types.Path|}>
type _FavoritesLoadPayload = void
type _FavoritesLoadedPayload = $ReadOnly<{|private: I.Map<string, Types.Tlf>, public: I.Map<string, Types.Tlf>, team: I.Map<string, Types.Tlf>|}>
type _FolderListLoadPayload = $ReadOnly<{|path: Types.Path, refreshTag?: Types.RefreshTag|}>
type _FolderListLoadedPayload = $ReadOnly<{|path: Types.Path, pathItems: I.Map<Types.Path, Types.PathItem>|}>
type _FsErrorPayload = $ReadOnly<{|error: Types.FsError|}>
type _HideSystemFileManagerIntegrationBannerPayload = void
type _InitSendAttachmentToChatPayload = $ReadOnly<{|path: Types.Path|}>
type _InitSendLinkToChatPayload = $ReadOnly<{|path: Types.Path|}>
type _JournalUpdatePayload = $ReadOnly<{|syncingPaths: Array<Types.Path>, totalSyncingBytes: number, endEstimate?: ?number|}>
type _KbfsDaemonOnlineStatusChangedPayload = $ReadOnly<{|online: boolean|}>
type _KbfsDaemonRpcStatusChangedPayload = $ReadOnly<{|rpcStatus: Types.KbfsDaemonRpcStatus|}>
type _LetResetUserBackInPayload = $ReadOnly<{|id: RPCTypes.TeamID, username: string|}>
type _LoadPathMetadataPayload = $ReadOnly<{|path: Types.Path, refreshTag?: ?Types.RefreshTag|}>
type _LoadTlfSyncConfigPayload = $ReadOnly<{|path: Types.Path|}>
type _LoadingPathPayload = $ReadOnly<{|path: Types.Path, id: string, done: boolean|}>
type _LocalHTTPServerInfoPayload = $ReadOnly<{|address: string, token: string|}>
type _MovePayload = $ReadOnly<{|destinationParentPath: Types.Path|}>
type _NewFolderNamePayload = $ReadOnly<{|editID: Types.EditID, name: string|}>
type _NewFolderRowPayload = $ReadOnly<{|parentPath: Types.Path|}>
type _NotifyTlfUpdatePayload = $ReadOnly<{|tlfPath: Types.Path|}>
type _OpenAndUploadPayload = $ReadOnly<{|type: Types.OpenDialogType, parentPath: Types.Path|}>
type _OpenFilesFromWidgetPayload = $ReadOnly<{|path: Types.Path, type: Types.PathType|}>
type _OpenLocalPathInSystemFileManagerPayload = $ReadOnly<{|localPath: string|}>
type _OpenPathInSystemFileManagerPayload = $ReadOnly<{|path: Types.Path|}>
type _OpenSecurityPreferencesPayload = void
type _OverallSyncStatusChangedPayload = $ReadOnly<{|status: Types.OverallSyncStatus|}>
type _PathItemLoadedPayload = $ReadOnly<{|path: Types.Path, pathItem: Types.PathItem|}>
type _PickAndUploadPayload = $ReadOnly<{|type: Types.MobilePickType, parentPath: Types.Path|}>
type _PlaceholderActionPayload = void
type _RefreshDriverStatusPayload = void
type _RefreshLocalHTTPServerInfoPayload = void
type _SaveMediaPayload = $ReadOnly<{|path: Types.Path, key: string|}>
type _SentAttachmentToChatPayload = void
type _SentLinkToChatPayload = $ReadOnly<{|convID: ChatTypes.ConversationIDKey|}>
type _SetDestinationPickerParentPathPayload = $ReadOnly<{|index: number, path: Types.Path|}>
type _SetDriverStatusPayload = $ReadOnly<{|driverStatus: Types.DriverStatus|}>
type _SetFolderViewFilterPayload = $ReadOnly<{|filter: string|}>
type _SetIncomingShareLocalPathPayload = $ReadOnly<{|localPath: Types.LocalPath|}>
type _SetMoveOrCopySourcePayload = $ReadOnly<{|path: Types.Path|}>
type _SetPathItemActionMenuDownloadKeyPayload = $ReadOnly<{|key: ?string|}>
type _SetPathItemActionMenuViewPayload = $ReadOnly<{|view: Types.PathItemActionMenuView|}>
type _SetSendAttachmentToChatConvIDPayload = $ReadOnly<{|convID: ChatTypes.ConversationIDKey|}>
type _SetSendAttachmentToChatFilterPayload = $ReadOnly<{|filter: string|}>
type _SetSendLinkToChatChannelsPayload = $ReadOnly<{|channels: I.Map<ChatTypes.ConversationIDKey, string>|}>
type _SetSendLinkToChatConvIDPayload = $ReadOnly<{|convID: ChatTypes.ConversationIDKey|}>
type _SetTlfSyncConfigPayload = $ReadOnly<{|enabled: boolean, path: Types.Path|}>
type _ShareNativePayload = $ReadOnly<{|path: Types.Path, key: string|}>
type _ShowIncomingSharePayload = $ReadOnly<{|initialDestinationParentPath: Types.Path|}>
type _ShowMoveOrCopyPayload = $ReadOnly<{|initialDestinationParentPath: Types.Path|}>
type _ShowSystemFileManagerIntegrationBannerPayload = void
type _SortSettingPayload = $ReadOnly<{|path: Types.Path, sortSetting: Types.SortSetting|}>
type _TlfSyncConfigLoadedPayload = $ReadOnly<{|tlfType: Types.TlfType, tlfName: string, syncConfig: Types.TlfSyncConfig|}>
type _TlfSyncConfigsLoadedPayload = $ReadOnly<{|private: I.Map<string, Types.TlfSyncConfig>, public: I.Map<string, Types.TlfSyncConfig>, team: I.Map<string, Types.TlfSyncConfig>|}>
type _TriggerSendLinkToChatPayload = void
type _UninstallKBFSConfirmPayload = void
type _UploadPayload = $ReadOnly<{|parentPath: Types.Path, localPath: string|}>
type _UploadStartedPayload = $ReadOnly<{|path: Types.Path|}>
type _UploadWritingSuccessPayload = $ReadOnly<{|path: Types.Path|}>
type _UserFileEditsLoadPayload = void
type _UserFileEditsLoadedPayload = $ReadOnly<{|tlfUpdates: Types.UserTlfUpdates|}>
type _WaitForKbfsDaemonPayload = void

// Action Creators
export const createCancelDownload = (payload: _CancelDownloadPayload) => ({payload, type: cancelDownload})
export const createClearRefreshTag = (payload: _ClearRefreshTagPayload) => ({payload, type: clearRefreshTag})
export const createCloseDestinationPicker = (payload: _CloseDestinationPickerPayload) => ({payload, type: closeDestinationPicker})
export const createCommitEdit = (payload: _CommitEditPayload) => ({payload, type: commitEdit})
export const createCopy = (payload: _CopyPayload) => ({payload, type: copy})
export const createDeleteFile = (payload: _DeleteFilePayload) => ({payload, type: deleteFile})
export const createDiscardEdit = (payload: _DiscardEditPayload) => ({payload, type: discardEdit})
export const createDismissDownload = (payload: _DismissDownloadPayload) => ({payload, type: dismissDownload})
export const createDismissFsError = (payload: _DismissFsErrorPayload) => ({payload, type: dismissFsError})
export const createDownload = (payload: _DownloadPayload) => ({payload, type: download})
export const createDownloadProgress = (payload: _DownloadProgressPayload) => ({payload, type: downloadProgress})
export const createDownloadStarted = (payload: _DownloadStartedPayload) => ({payload, type: downloadStarted})
export const createDownloadSuccess = (payload: _DownloadSuccessPayload) => ({payload, type: downloadSuccess})
export const createDriverDisable = (payload: _DriverDisablePayload) => ({payload, type: driverDisable})
export const createDriverEnable = (payload: _DriverEnablePayload) => ({payload, type: driverEnable})
export const createDriverKextPermissionError = (payload: _DriverKextPermissionErrorPayload) => ({payload, type: driverKextPermissionError})
export const createEditSuccess = (payload: _EditSuccessPayload) => ({payload, type: editSuccess})
export const createFavoriteIgnore = (payload: _FavoriteIgnorePayload) => ({payload, type: favoriteIgnore})
export const createFavoriteIgnoreError = (payload: _FavoriteIgnoreErrorPayload) => ({payload, type: favoriteIgnoreError})
export const createFavoritesLoad = (payload: _FavoritesLoadPayload) => ({payload, type: favoritesLoad})
export const createFavoritesLoaded = (payload: _FavoritesLoadedPayload) => ({payload, type: favoritesLoaded})
export const createFolderListLoad = (payload: _FolderListLoadPayload) => ({payload, type: folderListLoad})
export const createFolderListLoaded = (payload: _FolderListLoadedPayload) => ({payload, type: folderListLoaded})
export const createFsError = (payload: _FsErrorPayload) => ({payload, type: fsError})
export const createHideSystemFileManagerIntegrationBanner = (payload: _HideSystemFileManagerIntegrationBannerPayload) => ({payload, type: hideSystemFileManagerIntegrationBanner})
export const createInitSendAttachmentToChat = (payload: _InitSendAttachmentToChatPayload) => ({payload, type: initSendAttachmentToChat})
export const createInitSendLinkToChat = (payload: _InitSendLinkToChatPayload) => ({payload, type: initSendLinkToChat})
export const createJournalUpdate = (payload: _JournalUpdatePayload) => ({payload, type: journalUpdate})
export const createKbfsDaemonOnlineStatusChanged = (payload: _KbfsDaemonOnlineStatusChangedPayload) => ({payload, type: kbfsDaemonOnlineStatusChanged})
export const createKbfsDaemonRpcStatusChanged = (payload: _KbfsDaemonRpcStatusChangedPayload) => ({payload, type: kbfsDaemonRpcStatusChanged})
export const createLetResetUserBackIn = (payload: _LetResetUserBackInPayload) => ({payload, type: letResetUserBackIn})
export const createLoadPathMetadata = (payload: _LoadPathMetadataPayload) => ({payload, type: loadPathMetadata})
export const createLoadTlfSyncConfig = (payload: _LoadTlfSyncConfigPayload) => ({payload, type: loadTlfSyncConfig})
export const createLoadingPath = (payload: _LoadingPathPayload) => ({payload, type: loadingPath})
export const createLocalHTTPServerInfo = (payload: _LocalHTTPServerInfoPayload) => ({payload, type: localHTTPServerInfo})
export const createMove = (payload: _MovePayload) => ({payload, type: move})
export const createNewFolderName = (payload: _NewFolderNamePayload) => ({payload, type: newFolderName})
export const createNewFolderRow = (payload: _NewFolderRowPayload) => ({payload, type: newFolderRow})
export const createNotifyTlfUpdate = (payload: _NotifyTlfUpdatePayload) => ({payload, type: notifyTlfUpdate})
export const createOpenAndUpload = (payload: _OpenAndUploadPayload) => ({payload, type: openAndUpload})
export const createOpenFilesFromWidget = (payload: _OpenFilesFromWidgetPayload) => ({payload, type: openFilesFromWidget})
export const createOpenLocalPathInSystemFileManager = (payload: _OpenLocalPathInSystemFileManagerPayload) => ({payload, type: openLocalPathInSystemFileManager})
export const createOpenPathInSystemFileManager = (payload: _OpenPathInSystemFileManagerPayload) => ({payload, type: openPathInSystemFileManager})
export const createOpenSecurityPreferences = (payload: _OpenSecurityPreferencesPayload) => ({payload, type: openSecurityPreferences})
export const createOverallSyncStatusChanged = (payload: _OverallSyncStatusChangedPayload) => ({payload, type: overallSyncStatusChanged})
export const createPathItemLoaded = (payload: _PathItemLoadedPayload) => ({payload, type: pathItemLoaded})
export const createPickAndUpload = (payload: _PickAndUploadPayload) => ({payload, type: pickAndUpload})
export const createPlaceholderAction = (payload: _PlaceholderActionPayload) => ({payload, type: placeholderAction})
export const createRefreshDriverStatus = (payload: _RefreshDriverStatusPayload) => ({payload, type: refreshDriverStatus})
export const createRefreshLocalHTTPServerInfo = (payload: _RefreshLocalHTTPServerInfoPayload) => ({payload, type: refreshLocalHTTPServerInfo})
export const createSaveMedia = (payload: _SaveMediaPayload) => ({payload, type: saveMedia})
export const createSentAttachmentToChat = (payload: _SentAttachmentToChatPayload) => ({payload, type: sentAttachmentToChat})
export const createSentLinkToChat = (payload: _SentLinkToChatPayload) => ({payload, type: sentLinkToChat})
export const createSetDestinationPickerParentPath = (payload: _SetDestinationPickerParentPathPayload) => ({payload, type: setDestinationPickerParentPath})
export const createSetDriverStatus = (payload: _SetDriverStatusPayload) => ({payload, type: setDriverStatus})
export const createSetFolderViewFilter = (payload: _SetFolderViewFilterPayload) => ({payload, type: setFolderViewFilter})
export const createSetIncomingShareLocalPath = (payload: _SetIncomingShareLocalPathPayload) => ({payload, type: setIncomingShareLocalPath})
export const createSetMoveOrCopySource = (payload: _SetMoveOrCopySourcePayload) => ({payload, type: setMoveOrCopySource})
export const createSetPathItemActionMenuDownloadKey = (payload: _SetPathItemActionMenuDownloadKeyPayload) => ({payload, type: setPathItemActionMenuDownloadKey})
export const createSetPathItemActionMenuView = (payload: _SetPathItemActionMenuViewPayload) => ({payload, type: setPathItemActionMenuView})
export const createSetSendAttachmentToChatConvID = (payload: _SetSendAttachmentToChatConvIDPayload) => ({payload, type: setSendAttachmentToChatConvID})
export const createSetSendAttachmentToChatFilter = (payload: _SetSendAttachmentToChatFilterPayload) => ({payload, type: setSendAttachmentToChatFilter})
export const createSetSendLinkToChatChannels = (payload: _SetSendLinkToChatChannelsPayload) => ({payload, type: setSendLinkToChatChannels})
export const createSetSendLinkToChatConvID = (payload: _SetSendLinkToChatConvIDPayload) => ({payload, type: setSendLinkToChatConvID})
export const createSetTlfSyncConfig = (payload: _SetTlfSyncConfigPayload) => ({payload, type: setTlfSyncConfig})
export const createShareNative = (payload: _ShareNativePayload) => ({payload, type: shareNative})
export const createShowIncomingShare = (payload: _ShowIncomingSharePayload) => ({payload, type: showIncomingShare})
export const createShowMoveOrCopy = (payload: _ShowMoveOrCopyPayload) => ({payload, type: showMoveOrCopy})
export const createShowSystemFileManagerIntegrationBanner = (payload: _ShowSystemFileManagerIntegrationBannerPayload) => ({payload, type: showSystemFileManagerIntegrationBanner})
export const createSortSetting = (payload: _SortSettingPayload) => ({payload, type: sortSetting})
export const createTlfSyncConfigLoaded = (payload: _TlfSyncConfigLoadedPayload) => ({payload, type: tlfSyncConfigLoaded})
export const createTlfSyncConfigsLoaded = (payload: _TlfSyncConfigsLoadedPayload) => ({payload, type: tlfSyncConfigsLoaded})
export const createTriggerSendLinkToChat = (payload: _TriggerSendLinkToChatPayload) => ({payload, type: triggerSendLinkToChat})
export const createUninstallKBFSConfirm = (payload: _UninstallKBFSConfirmPayload) => ({payload, type: uninstallKBFSConfirm})
export const createUpload = (payload: _UploadPayload) => ({payload, type: upload})
export const createUploadStarted = (payload: _UploadStartedPayload) => ({payload, type: uploadStarted})
export const createUploadWritingSuccess = (payload: _UploadWritingSuccessPayload) => ({payload, type: uploadWritingSuccess})
export const createUserFileEditsLoad = (payload: _UserFileEditsLoadPayload) => ({payload, type: userFileEditsLoad})
export const createUserFileEditsLoaded = (payload: _UserFileEditsLoadedPayload) => ({payload, type: userFileEditsLoaded})
export const createWaitForKbfsDaemon = (payload: _WaitForKbfsDaemonPayload) => ({payload, type: waitForKbfsDaemon})

// Action Payloads
export type CancelDownloadPayload = {|+payload: _CancelDownloadPayload, +type: 'fs:cancelDownload'|}
export type ClearRefreshTagPayload = {|+payload: _ClearRefreshTagPayload, +type: 'fs:clearRefreshTag'|}
export type CloseDestinationPickerPayload = {|+payload: _CloseDestinationPickerPayload, +type: 'fs:closeDestinationPicker'|}
export type CommitEditPayload = {|+payload: _CommitEditPayload, +type: 'fs:commitEdit'|}
export type CopyPayload = {|+payload: _CopyPayload, +type: 'fs:copy'|}
export type DeleteFilePayload = {|+payload: _DeleteFilePayload, +type: 'fs:deleteFile'|}
export type DiscardEditPayload = {|+payload: _DiscardEditPayload, +type: 'fs:discardEdit'|}
export type DismissDownloadPayload = {|+payload: _DismissDownloadPayload, +type: 'fs:dismissDownload'|}
export type DismissFsErrorPayload = {|+payload: _DismissFsErrorPayload, +type: 'fs:dismissFsError'|}
export type DownloadPayload = {|+payload: _DownloadPayload, +type: 'fs:download'|}
export type DownloadProgressPayload = {|+payload: _DownloadProgressPayload, +type: 'fs:downloadProgress'|}
export type DownloadStartedPayload = {|+payload: _DownloadStartedPayload, +type: 'fs:downloadStarted'|}
export type DownloadSuccessPayload = {|+payload: _DownloadSuccessPayload, +type: 'fs:downloadSuccess'|}
export type DriverDisablePayload = {|+payload: _DriverDisablePayload, +type: 'fs:driverDisable'|}
export type DriverEnablePayload = {|+payload: _DriverEnablePayload, +type: 'fs:driverEnable'|}
export type DriverKextPermissionErrorPayload = {|+payload: _DriverKextPermissionErrorPayload, +type: 'fs:driverKextPermissionError'|}
export type EditSuccessPayload = {|+payload: _EditSuccessPayload, +type: 'fs:editSuccess'|}
export type FavoriteIgnoreErrorPayload = {|+payload: _FavoriteIgnoreErrorPayload, +type: 'fs:favoriteIgnoreError'|}
export type FavoriteIgnorePayload = {|+payload: _FavoriteIgnorePayload, +type: 'fs:favoriteIgnore'|}
export type FavoritesLoadPayload = {|+payload: _FavoritesLoadPayload, +type: 'fs:favoritesLoad'|}
export type FavoritesLoadedPayload = {|+payload: _FavoritesLoadedPayload, +type: 'fs:favoritesLoaded'|}
export type FolderListLoadPayload = {|+payload: _FolderListLoadPayload, +type: 'fs:folderListLoad'|}
export type FolderListLoadedPayload = {|+payload: _FolderListLoadedPayload, +type: 'fs:folderListLoaded'|}
export type FsErrorPayload = {|+payload: _FsErrorPayload, +type: 'fs:fsError'|}
export type HideSystemFileManagerIntegrationBannerPayload = {|+payload: _HideSystemFileManagerIntegrationBannerPayload, +type: 'fs:hideSystemFileManagerIntegrationBanner'|}
export type InitSendAttachmentToChatPayload = {|+payload: _InitSendAttachmentToChatPayload, +type: 'fs:initSendAttachmentToChat'|}
export type InitSendLinkToChatPayload = {|+payload: _InitSendLinkToChatPayload, +type: 'fs:initSendLinkToChat'|}
export type JournalUpdatePayload = {|+payload: _JournalUpdatePayload, +type: 'fs:journalUpdate'|}
export type KbfsDaemonOnlineStatusChangedPayload = {|+payload: _KbfsDaemonOnlineStatusChangedPayload, +type: 'fs:kbfsDaemonOnlineStatusChanged'|}
export type KbfsDaemonRpcStatusChangedPayload = {|+payload: _KbfsDaemonRpcStatusChangedPayload, +type: 'fs:kbfsDaemonRpcStatusChanged'|}
export type LetResetUserBackInPayload = {|+payload: _LetResetUserBackInPayload, +type: 'fs:letResetUserBackIn'|}
export type LoadPathMetadataPayload = {|+payload: _LoadPathMetadataPayload, +type: 'fs:loadPathMetadata'|}
export type LoadTlfSyncConfigPayload = {|+payload: _LoadTlfSyncConfigPayload, +type: 'fs:loadTlfSyncConfig'|}
export type LoadingPathPayload = {|+payload: _LoadingPathPayload, +type: 'fs:loadingPath'|}
export type LocalHTTPServerInfoPayload = {|+payload: _LocalHTTPServerInfoPayload, +type: 'fs:localHTTPServerInfo'|}
export type MovePayload = {|+payload: _MovePayload, +type: 'fs:move'|}
export type NewFolderNamePayload = {|+payload: _NewFolderNamePayload, +type: 'fs:newFolderName'|}
export type NewFolderRowPayload = {|+payload: _NewFolderRowPayload, +type: 'fs:newFolderRow'|}
export type NotifyTlfUpdatePayload = {|+payload: _NotifyTlfUpdatePayload, +type: 'fs:notifyTlfUpdate'|}
export type OpenAndUploadPayload = {|+payload: _OpenAndUploadPayload, +type: 'fs:openAndUpload'|}
export type OpenFilesFromWidgetPayload = {|+payload: _OpenFilesFromWidgetPayload, +type: 'fs:openFilesFromWidget'|}
export type OpenLocalPathInSystemFileManagerPayload = {|+payload: _OpenLocalPathInSystemFileManagerPayload, +type: 'fs:openLocalPathInSystemFileManager'|}
export type OpenPathInSystemFileManagerPayload = {|+payload: _OpenPathInSystemFileManagerPayload, +type: 'fs:openPathInSystemFileManager'|}
export type OpenSecurityPreferencesPayload = {|+payload: _OpenSecurityPreferencesPayload, +type: 'fs:openSecurityPreferences'|}
export type OverallSyncStatusChangedPayload = {|+payload: _OverallSyncStatusChangedPayload, +type: 'fs:overallSyncStatusChanged'|}
export type PathItemLoadedPayload = {|+payload: _PathItemLoadedPayload, +type: 'fs:pathItemLoaded'|}
export type PickAndUploadPayload = {|+payload: _PickAndUploadPayload, +type: 'fs:pickAndUpload'|}
export type PlaceholderActionPayload = {|+payload: _PlaceholderActionPayload, +type: 'fs:placeholderAction'|}
export type RefreshDriverStatusPayload = {|+payload: _RefreshDriverStatusPayload, +type: 'fs:refreshDriverStatus'|}
export type RefreshLocalHTTPServerInfoPayload = {|+payload: _RefreshLocalHTTPServerInfoPayload, +type: 'fs:refreshLocalHTTPServerInfo'|}
export type SaveMediaPayload = {|+payload: _SaveMediaPayload, +type: 'fs:saveMedia'|}
export type SentAttachmentToChatPayload = {|+payload: _SentAttachmentToChatPayload, +type: 'fs:sentAttachmentToChat'|}
export type SentLinkToChatPayload = {|+payload: _SentLinkToChatPayload, +type: 'fs:sentLinkToChat'|}
export type SetDestinationPickerParentPathPayload = {|+payload: _SetDestinationPickerParentPathPayload, +type: 'fs:setDestinationPickerParentPath'|}
export type SetDriverStatusPayload = {|+payload: _SetDriverStatusPayload, +type: 'fs:setDriverStatus'|}
export type SetFolderViewFilterPayload = {|+payload: _SetFolderViewFilterPayload, +type: 'fs:setFolderViewFilter'|}
export type SetIncomingShareLocalPathPayload = {|+payload: _SetIncomingShareLocalPathPayload, +type: 'fs:setIncomingShareLocalPath'|}
export type SetMoveOrCopySourcePayload = {|+payload: _SetMoveOrCopySourcePayload, +type: 'fs:setMoveOrCopySource'|}
export type SetPathItemActionMenuDownloadKeyPayload = {|+payload: _SetPathItemActionMenuDownloadKeyPayload, +type: 'fs:setPathItemActionMenuDownloadKey'|}
export type SetPathItemActionMenuViewPayload = {|+payload: _SetPathItemActionMenuViewPayload, +type: 'fs:setPathItemActionMenuView'|}
export type SetSendAttachmentToChatConvIDPayload = {|+payload: _SetSendAttachmentToChatConvIDPayload, +type: 'fs:setSendAttachmentToChatConvID'|}
export type SetSendAttachmentToChatFilterPayload = {|+payload: _SetSendAttachmentToChatFilterPayload, +type: 'fs:setSendAttachmentToChatFilter'|}
export type SetSendLinkToChatChannelsPayload = {|+payload: _SetSendLinkToChatChannelsPayload, +type: 'fs:setSendLinkToChatChannels'|}
export type SetSendLinkToChatConvIDPayload = {|+payload: _SetSendLinkToChatConvIDPayload, +type: 'fs:setSendLinkToChatConvID'|}
export type SetTlfSyncConfigPayload = {|+payload: _SetTlfSyncConfigPayload, +type: 'fs:setTlfSyncConfig'|}
export type ShareNativePayload = {|+payload: _ShareNativePayload, +type: 'fs:shareNative'|}
export type ShowIncomingSharePayload = {|+payload: _ShowIncomingSharePayload, +type: 'fs:showIncomingShare'|}
export type ShowMoveOrCopyPayload = {|+payload: _ShowMoveOrCopyPayload, +type: 'fs:showMoveOrCopy'|}
export type ShowSystemFileManagerIntegrationBannerPayload = {|+payload: _ShowSystemFileManagerIntegrationBannerPayload, +type: 'fs:showSystemFileManagerIntegrationBanner'|}
export type SortSettingPayload = {|+payload: _SortSettingPayload, +type: 'fs:sortSetting'|}
export type TlfSyncConfigLoadedPayload = {|+payload: _TlfSyncConfigLoadedPayload, +type: 'fs:tlfSyncConfigLoaded'|}
export type TlfSyncConfigsLoadedPayload = {|+payload: _TlfSyncConfigsLoadedPayload, +type: 'fs:tlfSyncConfigsLoaded'|}
export type TriggerSendLinkToChatPayload = {|+payload: _TriggerSendLinkToChatPayload, +type: 'fs:triggerSendLinkToChat'|}
export type UninstallKBFSConfirmPayload = {|+payload: _UninstallKBFSConfirmPayload, +type: 'fs:uninstallKBFSConfirm'|}
export type UploadPayload = {|+payload: _UploadPayload, +type: 'fs:upload'|}
export type UploadStartedPayload = {|+payload: _UploadStartedPayload, +type: 'fs:uploadStarted'|}
export type UploadWritingSuccessPayload = {|+payload: _UploadWritingSuccessPayload, +type: 'fs:uploadWritingSuccess'|}
export type UserFileEditsLoadPayload = {|+payload: _UserFileEditsLoadPayload, +type: 'fs:userFileEditsLoad'|}
export type UserFileEditsLoadedPayload = {|+payload: _UserFileEditsLoadedPayload, +type: 'fs:userFileEditsLoaded'|}
export type WaitForKbfsDaemonPayload = {|+payload: _WaitForKbfsDaemonPayload, +type: 'fs:waitForKbfsDaemon'|}

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
  | HideSystemFileManagerIntegrationBannerPayload
  | InitSendAttachmentToChatPayload
  | InitSendLinkToChatPayload
  | JournalUpdatePayload
  | KbfsDaemonOnlineStatusChangedPayload
  | KbfsDaemonRpcStatusChangedPayload
  | LetResetUserBackInPayload
  | LoadPathMetadataPayload
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
  | SetMoveOrCopySourcePayload
  | SetPathItemActionMenuDownloadKeyPayload
  | SetPathItemActionMenuViewPayload
  | SetSendAttachmentToChatConvIDPayload
  | SetSendAttachmentToChatFilterPayload
  | SetSendLinkToChatChannelsPayload
  | SetSendLinkToChatConvIDPayload
  | SetTlfSyncConfigPayload
  | ShareNativePayload
  | ShowIncomingSharePayload
  | ShowMoveOrCopyPayload
  | ShowSystemFileManagerIntegrationBannerPayload
  | SortSettingPayload
  | TlfSyncConfigLoadedPayload
  | TlfSyncConfigsLoadedPayload
  | TriggerSendLinkToChatPayload
  | UninstallKBFSConfirmPayload
  | UploadPayload
  | UploadStartedPayload
  | UploadWritingSuccessPayload
  | UserFileEditsLoadPayload
  | UserFileEditsLoadedPayload
  | WaitForKbfsDaemonPayload
  | {type: 'common:resetStore', payload: null}
