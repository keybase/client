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
export const destinationPickerOpen = 'fs:destinationPickerOpen'
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
export const journalUpdate = 'fs:journalUpdate'
export const kbfsDaemonStatusChanged = 'fs:kbfsDaemonStatusChanged'
export const letResetUserBackIn = 'fs:letResetUserBackIn'
export const loadPathMetadata = 'fs:loadPathMetadata'
export const loadingPath = 'fs:loadingPath'
export const localHTTPServerInfo = 'fs:localHTTPServerInfo'
export const mimeTypeLoad = 'fs:mimeTypeLoad'
export const mimeTypeLoaded = 'fs:mimeTypeLoaded'
export const move = 'fs:move'
export const newFolderName = 'fs:newFolderName'
export const newFolderRow = 'fs:newFolderRow'
export const notifySyncActivity = 'fs:notifySyncActivity'
export const notifyTlfUpdate = 'fs:notifyTlfUpdate'
export const openAndUpload = 'fs:openAndUpload'
export const openFilesFromWidget = 'fs:openFilesFromWidget'
export const openLocalPathInSystemFileManager = 'fs:openLocalPathInSystemFileManager'
export const openPathInFilesTab = 'fs:openPathInFilesTab'
export const openPathInSystemFileManager = 'fs:openPathInSystemFileManager'
export const openPathItem = 'fs:openPathItem'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const pathItemLoad = 'fs:pathItemLoad'
export const pathItemLoaded = 'fs:pathItemLoaded'
export const pickAndUpload = 'fs:pickAndUpload'
export const placeholderAction = 'fs:placeholderAction'
export const refreshDriverStatus = 'fs:refreshDriverStatus'
export const refreshLocalHTTPServerInfo = 'fs:refreshLocalHTTPServerInfo'
export const saveMedia = 'fs:saveMedia'
export const setDestinationPickerParentPath = 'fs:setDestinationPickerParentPath'
export const setDriverStatus = 'fs:setDriverStatus'
export const setIncomingShareLocalPath = 'fs:setIncomingShareLocalPath'
export const setMoveOrCopySource = 'fs:setMoveOrCopySource'
export const setPathItemActionMenuDownloadKey = 'fs:setPathItemActionMenuDownloadKey'
export const setPathItemActionMenuView = 'fs:setPathItemActionMenuView'
export const setSendAttachmentToChatConvID = 'fs:setSendAttachmentToChatConvID'
export const setSendAttachmentToChatFilter = 'fs:setSendAttachmentToChatFilter'
export const setSendLinkToChatChannels = 'fs:setSendLinkToChatChannels'
export const setSendLinkToChatConvID = 'fs:setSendLinkToChatConvID'
export const shareNative = 'fs:shareNative'
export const showIncomingShare = 'fs:showIncomingShare'
export const showMoveOrCopy = 'fs:showMoveOrCopy'
export const showSendAttachmentToChat = 'fs:showSendAttachmentToChat'
export const showSendLinkToChat = 'fs:showSendLinkToChat'
export const showSystemFileManagerIntegrationBanner = 'fs:showSystemFileManagerIntegrationBanner'
export const sortSetting = 'fs:sortSetting'
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
type _DestinationPickerOpenPayload = $ReadOnly<{|routePath: I.List<string>, path: Types.Path, currentIndex: number|}>
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
type _JournalUpdatePayload = $ReadOnly<{|syncingPaths: Array<Types.Path>, totalSyncingBytes: number, endEstimate?: ?number|}>
type _KbfsDaemonStatusChangedPayload = $ReadOnly<{|kbfsDaemonStatus: Types.KbfsDaemonStatus|}>
type _LetResetUserBackInPayload = $ReadOnly<{|id: RPCTypes.TeamID, username: string|}>
type _LoadPathMetadataPayload = $ReadOnly<{|path: Types.Path|}>
type _LoadingPathPayload = $ReadOnly<{|path: Types.Path, id: string, done: boolean|}>
type _LocalHTTPServerInfoPayload = $ReadOnly<{|address: string, token: string|}>
type _MimeTypeLoadPayload = $ReadOnly<{|path: Types.Path, refreshTag?: Types.RefreshTag|}>
type _MimeTypeLoadedPayload = $ReadOnly<{|path: Types.Path, mimeType: Types.Mime|}>
type _MovePayload = $ReadOnly<{|destinationParentPath: Types.Path|}>
type _NewFolderNamePayload = $ReadOnly<{|editID: Types.EditID, name: string|}>
type _NewFolderRowPayload = $ReadOnly<{|parentPath: Types.Path|}>
type _NotifySyncActivityPayload = void
type _NotifyTlfUpdatePayload = $ReadOnly<{|tlfPath: Types.Path|}>
type _OpenAndUploadPayload = $ReadOnly<{|type: Types.OpenDialogType, parentPath: Types.Path|}>
type _OpenFilesFromWidgetPayload = $ReadOnly<{|path: Types.Path, type: Types.PathType|}>
type _OpenLocalPathInSystemFileManagerPayload = $ReadOnly<{|localPath: string|}>
type _OpenPathInFilesTabPayload = $ReadOnly<{|path: Types.Path, routePath?: I.List<string>|}>
type _OpenPathInSystemFileManagerPayload = $ReadOnly<{|path: Types.Path|}>
type _OpenPathItemPayload = $ReadOnly<{|path: Types.Path, routePath: I.List<string>|}>
type _OpenSecurityPreferencesPayload = void
type _PathItemLoadPayload = $ReadOnly<{|path: Types.Path, identifyBehavior?: ?RPCTypes.TLFIdentifyBehavior, silenceErrors?: ?boolean|}>
type _PathItemLoadedPayload = $ReadOnly<{|path: Types.Path, meta: Types.PathItem|}>
type _PickAndUploadPayload = $ReadOnly<{|type: Types.MobilePickType, parentPath: Types.Path|}>
type _PlaceholderActionPayload = void
type _RefreshDriverStatusPayload = void
type _RefreshLocalHTTPServerInfoPayload = void
type _SaveMediaPayload = $ReadOnly<{|path: Types.Path, key: string|}>
type _SetDestinationPickerParentPathPayload = $ReadOnly<{|index: number, path: Types.Path|}>
type _SetDriverStatusPayload = $ReadOnly<{|driverStatus: Types.DriverStatus|}>
type _SetIncomingShareLocalPathPayload = $ReadOnly<{|localPath: Types.LocalPath|}>
type _SetMoveOrCopySourcePayload = $ReadOnly<{|path: Types.Path|}>
type _SetPathItemActionMenuDownloadKeyPayload = $ReadOnly<{|key: ?string|}>
type _SetPathItemActionMenuViewPayload = $ReadOnly<{|view: Types.PathItemActionMenuView|}>
type _SetSendAttachmentToChatConvIDPayload = $ReadOnly<{|convID: ChatTypes.ConversationIDKey|}>
type _SetSendAttachmentToChatFilterPayload = $ReadOnly<{|filter: string|}>
type _SetSendLinkToChatChannelsPayload = $ReadOnly<{|channels: I.Map<ChatTypes.ConversationIDKey, string>|}>
type _SetSendLinkToChatConvIDPayload = $ReadOnly<{|convID: ChatTypes.ConversationIDKey|}>
type _ShareNativePayload = $ReadOnly<{|path: Types.Path, key: string|}>
type _ShowIncomingSharePayload = $ReadOnly<{|initialDestinationParentPath: Types.Path|}>
type _ShowMoveOrCopyPayload = $ReadOnly<{|initialDestinationParentPath: Types.Path|}>
type _ShowSendAttachmentToChatPayload = $ReadOnly<{|path: Types.Path, routePath?: ?I.List<string>|}>
type _ShowSendLinkToChatPayload = $ReadOnly<{|path: Types.Path, routePath?: ?I.List<string>|}>
type _ShowSystemFileManagerIntegrationBannerPayload = void
type _SortSettingPayload = $ReadOnly<{|path: Types.Path, sortSetting: Types.SortSetting|}>
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
export const createDestinationPickerOpen = (payload: _DestinationPickerOpenPayload) => ({payload, type: destinationPickerOpen})
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
export const createJournalUpdate = (payload: _JournalUpdatePayload) => ({payload, type: journalUpdate})
export const createKbfsDaemonStatusChanged = (payload: _KbfsDaemonStatusChangedPayload) => ({payload, type: kbfsDaemonStatusChanged})
export const createLetResetUserBackIn = (payload: _LetResetUserBackInPayload) => ({payload, type: letResetUserBackIn})
export const createLoadPathMetadata = (payload: _LoadPathMetadataPayload) => ({payload, type: loadPathMetadata})
export const createLoadingPath = (payload: _LoadingPathPayload) => ({payload, type: loadingPath})
export const createLocalHTTPServerInfo = (payload: _LocalHTTPServerInfoPayload) => ({payload, type: localHTTPServerInfo})
export const createMimeTypeLoad = (payload: _MimeTypeLoadPayload) => ({payload, type: mimeTypeLoad})
export const createMimeTypeLoaded = (payload: _MimeTypeLoadedPayload) => ({payload, type: mimeTypeLoaded})
export const createMove = (payload: _MovePayload) => ({payload, type: move})
export const createNewFolderName = (payload: _NewFolderNamePayload) => ({payload, type: newFolderName})
export const createNewFolderRow = (payload: _NewFolderRowPayload) => ({payload, type: newFolderRow})
export const createNotifySyncActivity = (payload: _NotifySyncActivityPayload) => ({payload, type: notifySyncActivity})
export const createNotifyTlfUpdate = (payload: _NotifyTlfUpdatePayload) => ({payload, type: notifyTlfUpdate})
export const createOpenAndUpload = (payload: _OpenAndUploadPayload) => ({payload, type: openAndUpload})
export const createOpenFilesFromWidget = (payload: _OpenFilesFromWidgetPayload) => ({payload, type: openFilesFromWidget})
export const createOpenLocalPathInSystemFileManager = (payload: _OpenLocalPathInSystemFileManagerPayload) => ({payload, type: openLocalPathInSystemFileManager})
export const createOpenPathInFilesTab = (payload: _OpenPathInFilesTabPayload) => ({payload, type: openPathInFilesTab})
export const createOpenPathInSystemFileManager = (payload: _OpenPathInSystemFileManagerPayload) => ({payload, type: openPathInSystemFileManager})
export const createOpenPathItem = (payload: _OpenPathItemPayload) => ({payload, type: openPathItem})
export const createOpenSecurityPreferences = (payload: _OpenSecurityPreferencesPayload) => ({payload, type: openSecurityPreferences})
export const createPathItemLoad = (payload: _PathItemLoadPayload) => ({payload, type: pathItemLoad})
export const createPathItemLoaded = (payload: _PathItemLoadedPayload) => ({payload, type: pathItemLoaded})
export const createPickAndUpload = (payload: _PickAndUploadPayload) => ({payload, type: pickAndUpload})
export const createPlaceholderAction = (payload: _PlaceholderActionPayload) => ({payload, type: placeholderAction})
export const createRefreshDriverStatus = (payload: _RefreshDriverStatusPayload) => ({payload, type: refreshDriverStatus})
export const createRefreshLocalHTTPServerInfo = (payload: _RefreshLocalHTTPServerInfoPayload) => ({payload, type: refreshLocalHTTPServerInfo})
export const createSaveMedia = (payload: _SaveMediaPayload) => ({payload, type: saveMedia})
export const createSetDestinationPickerParentPath = (payload: _SetDestinationPickerParentPathPayload) => ({payload, type: setDestinationPickerParentPath})
export const createSetDriverStatus = (payload: _SetDriverStatusPayload) => ({payload, type: setDriverStatus})
export const createSetIncomingShareLocalPath = (payload: _SetIncomingShareLocalPathPayload) => ({payload, type: setIncomingShareLocalPath})
export const createSetMoveOrCopySource = (payload: _SetMoveOrCopySourcePayload) => ({payload, type: setMoveOrCopySource})
export const createSetPathItemActionMenuDownloadKey = (payload: _SetPathItemActionMenuDownloadKeyPayload) => ({payload, type: setPathItemActionMenuDownloadKey})
export const createSetPathItemActionMenuView = (payload: _SetPathItemActionMenuViewPayload) => ({payload, type: setPathItemActionMenuView})
export const createSetSendAttachmentToChatConvID = (payload: _SetSendAttachmentToChatConvIDPayload) => ({payload, type: setSendAttachmentToChatConvID})
export const createSetSendAttachmentToChatFilter = (payload: _SetSendAttachmentToChatFilterPayload) => ({payload, type: setSendAttachmentToChatFilter})
export const createSetSendLinkToChatChannels = (payload: _SetSendLinkToChatChannelsPayload) => ({payload, type: setSendLinkToChatChannels})
export const createSetSendLinkToChatConvID = (payload: _SetSendLinkToChatConvIDPayload) => ({payload, type: setSendLinkToChatConvID})
export const createShareNative = (payload: _ShareNativePayload) => ({payload, type: shareNative})
export const createShowIncomingShare = (payload: _ShowIncomingSharePayload) => ({payload, type: showIncomingShare})
export const createShowMoveOrCopy = (payload: _ShowMoveOrCopyPayload) => ({payload, type: showMoveOrCopy})
export const createShowSendAttachmentToChat = (payload: _ShowSendAttachmentToChatPayload) => ({payload, type: showSendAttachmentToChat})
export const createShowSendLinkToChat = (payload: _ShowSendLinkToChatPayload) => ({payload, type: showSendLinkToChat})
export const createShowSystemFileManagerIntegrationBanner = (payload: _ShowSystemFileManagerIntegrationBannerPayload) => ({payload, type: showSystemFileManagerIntegrationBanner})
export const createSortSetting = (payload: _SortSettingPayload) => ({payload, type: sortSetting})
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
export type DestinationPickerOpenPayload = {|+payload: _DestinationPickerOpenPayload, +type: 'fs:destinationPickerOpen'|}
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
export type JournalUpdatePayload = {|+payload: _JournalUpdatePayload, +type: 'fs:journalUpdate'|}
export type KbfsDaemonStatusChangedPayload = {|+payload: _KbfsDaemonStatusChangedPayload, +type: 'fs:kbfsDaemonStatusChanged'|}
export type LetResetUserBackInPayload = {|+payload: _LetResetUserBackInPayload, +type: 'fs:letResetUserBackIn'|}
export type LoadPathMetadataPayload = {|+payload: _LoadPathMetadataPayload, +type: 'fs:loadPathMetadata'|}
export type LoadingPathPayload = {|+payload: _LoadingPathPayload, +type: 'fs:loadingPath'|}
export type LocalHTTPServerInfoPayload = {|+payload: _LocalHTTPServerInfoPayload, +type: 'fs:localHTTPServerInfo'|}
export type MimeTypeLoadPayload = {|+payload: _MimeTypeLoadPayload, +type: 'fs:mimeTypeLoad'|}
export type MimeTypeLoadedPayload = {|+payload: _MimeTypeLoadedPayload, +type: 'fs:mimeTypeLoaded'|}
export type MovePayload = {|+payload: _MovePayload, +type: 'fs:move'|}
export type NewFolderNamePayload = {|+payload: _NewFolderNamePayload, +type: 'fs:newFolderName'|}
export type NewFolderRowPayload = {|+payload: _NewFolderRowPayload, +type: 'fs:newFolderRow'|}
export type NotifySyncActivityPayload = {|+payload: _NotifySyncActivityPayload, +type: 'fs:notifySyncActivity'|}
export type NotifyTlfUpdatePayload = {|+payload: _NotifyTlfUpdatePayload, +type: 'fs:notifyTlfUpdate'|}
export type OpenAndUploadPayload = {|+payload: _OpenAndUploadPayload, +type: 'fs:openAndUpload'|}
export type OpenFilesFromWidgetPayload = {|+payload: _OpenFilesFromWidgetPayload, +type: 'fs:openFilesFromWidget'|}
export type OpenLocalPathInSystemFileManagerPayload = {|+payload: _OpenLocalPathInSystemFileManagerPayload, +type: 'fs:openLocalPathInSystemFileManager'|}
export type OpenPathInFilesTabPayload = {|+payload: _OpenPathInFilesTabPayload, +type: 'fs:openPathInFilesTab'|}
export type OpenPathInSystemFileManagerPayload = {|+payload: _OpenPathInSystemFileManagerPayload, +type: 'fs:openPathInSystemFileManager'|}
export type OpenPathItemPayload = {|+payload: _OpenPathItemPayload, +type: 'fs:openPathItem'|}
export type OpenSecurityPreferencesPayload = {|+payload: _OpenSecurityPreferencesPayload, +type: 'fs:openSecurityPreferences'|}
export type PathItemLoadPayload = {|+payload: _PathItemLoadPayload, +type: 'fs:pathItemLoad'|}
export type PathItemLoadedPayload = {|+payload: _PathItemLoadedPayload, +type: 'fs:pathItemLoaded'|}
export type PickAndUploadPayload = {|+payload: _PickAndUploadPayload, +type: 'fs:pickAndUpload'|}
export type PlaceholderActionPayload = {|+payload: _PlaceholderActionPayload, +type: 'fs:placeholderAction'|}
export type RefreshDriverStatusPayload = {|+payload: _RefreshDriverStatusPayload, +type: 'fs:refreshDriverStatus'|}
export type RefreshLocalHTTPServerInfoPayload = {|+payload: _RefreshLocalHTTPServerInfoPayload, +type: 'fs:refreshLocalHTTPServerInfo'|}
export type SaveMediaPayload = {|+payload: _SaveMediaPayload, +type: 'fs:saveMedia'|}
export type SetDestinationPickerParentPathPayload = {|+payload: _SetDestinationPickerParentPathPayload, +type: 'fs:setDestinationPickerParentPath'|}
export type SetDriverStatusPayload = {|+payload: _SetDriverStatusPayload, +type: 'fs:setDriverStatus'|}
export type SetIncomingShareLocalPathPayload = {|+payload: _SetIncomingShareLocalPathPayload, +type: 'fs:setIncomingShareLocalPath'|}
export type SetMoveOrCopySourcePayload = {|+payload: _SetMoveOrCopySourcePayload, +type: 'fs:setMoveOrCopySource'|}
export type SetPathItemActionMenuDownloadKeyPayload = {|+payload: _SetPathItemActionMenuDownloadKeyPayload, +type: 'fs:setPathItemActionMenuDownloadKey'|}
export type SetPathItemActionMenuViewPayload = {|+payload: _SetPathItemActionMenuViewPayload, +type: 'fs:setPathItemActionMenuView'|}
export type SetSendAttachmentToChatConvIDPayload = {|+payload: _SetSendAttachmentToChatConvIDPayload, +type: 'fs:setSendAttachmentToChatConvID'|}
export type SetSendAttachmentToChatFilterPayload = {|+payload: _SetSendAttachmentToChatFilterPayload, +type: 'fs:setSendAttachmentToChatFilter'|}
export type SetSendLinkToChatChannelsPayload = {|+payload: _SetSendLinkToChatChannelsPayload, +type: 'fs:setSendLinkToChatChannels'|}
export type SetSendLinkToChatConvIDPayload = {|+payload: _SetSendLinkToChatConvIDPayload, +type: 'fs:setSendLinkToChatConvID'|}
export type ShareNativePayload = {|+payload: _ShareNativePayload, +type: 'fs:shareNative'|}
export type ShowIncomingSharePayload = {|+payload: _ShowIncomingSharePayload, +type: 'fs:showIncomingShare'|}
export type ShowMoveOrCopyPayload = {|+payload: _ShowMoveOrCopyPayload, +type: 'fs:showMoveOrCopy'|}
export type ShowSendAttachmentToChatPayload = {|+payload: _ShowSendAttachmentToChatPayload, +type: 'fs:showSendAttachmentToChat'|}
export type ShowSendLinkToChatPayload = {|+payload: _ShowSendLinkToChatPayload, +type: 'fs:showSendLinkToChat'|}
export type ShowSystemFileManagerIntegrationBannerPayload = {|+payload: _ShowSystemFileManagerIntegrationBannerPayload, +type: 'fs:showSystemFileManagerIntegrationBanner'|}
export type SortSettingPayload = {|+payload: _SortSettingPayload, +type: 'fs:sortSetting'|}
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
  | DestinationPickerOpenPayload
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
  | JournalUpdatePayload
  | KbfsDaemonStatusChangedPayload
  | LetResetUserBackInPayload
  | LoadPathMetadataPayload
  | LoadingPathPayload
  | LocalHTTPServerInfoPayload
  | MimeTypeLoadPayload
  | MimeTypeLoadedPayload
  | MovePayload
  | NewFolderNamePayload
  | NewFolderRowPayload
  | NotifySyncActivityPayload
  | NotifyTlfUpdatePayload
  | OpenAndUploadPayload
  | OpenFilesFromWidgetPayload
  | OpenLocalPathInSystemFileManagerPayload
  | OpenPathInFilesTabPayload
  | OpenPathInSystemFileManagerPayload
  | OpenPathItemPayload
  | OpenSecurityPreferencesPayload
  | PathItemLoadPayload
  | PathItemLoadedPayload
  | PickAndUploadPayload
  | PlaceholderActionPayload
  | RefreshDriverStatusPayload
  | RefreshLocalHTTPServerInfoPayload
  | SaveMediaPayload
  | SetDestinationPickerParentPathPayload
  | SetDriverStatusPayload
  | SetIncomingShareLocalPathPayload
  | SetMoveOrCopySourcePayload
  | SetPathItemActionMenuDownloadKeyPayload
  | SetPathItemActionMenuViewPayload
  | SetSendAttachmentToChatConvIDPayload
  | SetSendAttachmentToChatFilterPayload
  | SetSendLinkToChatChannelsPayload
  | SetSendLinkToChatConvIDPayload
  | ShareNativePayload
  | ShowIncomingSharePayload
  | ShowMoveOrCopyPayload
  | ShowSendAttachmentToChatPayload
  | ShowSendLinkToChatPayload
  | ShowSystemFileManagerIntegrationBannerPayload
  | SortSettingPayload
  | UninstallKBFSConfirmPayload
  | UploadPayload
  | UploadStartedPayload
  | UploadWritingSuccessPayload
  | UserFileEditsLoadPayload
  | UserFileEditsLoadedPayload
  | WaitForKbfsDaemonPayload
  | {type: 'common:resetStore', payload: null}
