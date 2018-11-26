// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/fs'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'fs:'
export const cancelDownload = 'fs:cancelDownload'
export const cancelMoveOrCopy = 'fs:cancelMoveOrCopy'
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
export const editSuccess = 'fs:editSuccess'
export const favoriteIgnore = 'fs:favoriteIgnore'
export const favoriteIgnoreError = 'fs:favoriteIgnoreError'
export const favoritesLoad = 'fs:favoritesLoad'
export const favoritesLoaded = 'fs:favoritesLoaded'
export const filePreviewLoad = 'fs:filePreviewLoad'
export const filePreviewLoaded = 'fs:filePreviewLoaded'
export const folderListLoad = 'fs:folderListLoad'
export const folderListLoaded = 'fs:folderListLoaded'
export const fsError = 'fs:fsError'
export const fuseStatus = 'fs:fuseStatus'
export const fuseStatusResult = 'fs:fuseStatusResult'
export const installFuse = 'fs:installFuse'
export const installFuseResult = 'fs:installFuseResult'
export const installKBFS = 'fs:installKBFS'
export const journalUpdate = 'fs:journalUpdate'
export const letResetUserBackIn = 'fs:letResetUserBackIn'
export const loadingPath = 'fs:loadingPath'
export const localHTTPServerInfo = 'fs:localHTTPServerInfo'
export const mimeTypeLoad = 'fs:mimeTypeLoad'
export const mimeTypeLoaded = 'fs:mimeTypeLoaded'
export const move = 'fs:move'
export const moveOrCopyOpen = 'fs:moveOrCopyOpen'
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
export const pickAndUpload = 'fs:pickAndUpload'
export const placeholderAction = 'fs:placeholderAction'
export const refreshLocalHTTPServerInfo = 'fs:refreshLocalHTTPServerInfo'
export const saveMedia = 'fs:saveMedia'
export const setFlags = 'fs:setFlags'
export const setMoveOrCopyDestinationParentPath = 'fs:setMoveOrCopyDestinationParentPath'
export const setMoveOrCopySource = 'fs:setMoveOrCopySource'
export const shareNative = 'fs:shareNative'
export const showMoveOrCopy = 'fs:showMoveOrCopy'
export const sortSetting = 'fs:sortSetting'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'
export const upload = 'fs:upload'
export const uploadStarted = 'fs:uploadStarted'
export const uploadWritingSuccess = 'fs:uploadWritingSuccess'
export const userFileEditsLoad = 'fs:userFileEditsLoad'
export const userFileEditsLoaded = 'fs:userFileEditsLoaded'

// Payload Types
type _CancelDownloadPayload = $ReadOnly<{|key: string|}>
type _CancelMoveOrCopyPayload = void
type _CommitEditPayload = $ReadOnly<{|editID: Types.EditID|}>
type _CopyPayload = $ReadOnly<{|destinationParentPath: Types.Path|}>
type _DeleteFilePayload = $ReadOnly<{|path: Types.Path|}>
type _DiscardEditPayload = $ReadOnly<{|editID: Types.EditID|}>
type _DismissDownloadPayload = $ReadOnly<{|key: string|}>
type _DismissFsErrorPayload = $ReadOnly<{|key: string|}>
type _DownloadPayload = $ReadOnly<{|
  path: Types.Path,
  key: string,
|}>
type _DownloadProgressPayload = $ReadOnly<{|
  key: string,
  completePortion: number,
  endEstimate?: number,
|}>
type _DownloadStartedPayload = $ReadOnly<{|
  entryType?: Types.PathType,
  key: string,
  path: Types.Path,
  localPath: Types.LocalPath,
  intent: Types.DownloadIntent,
  opID: RPCTypes.OpID,
|}>
type _DownloadSuccessPayload = $ReadOnly<{|
  key: string,
  mimeType: string,
|}>
type _EditSuccessPayload = $ReadOnly<{|
  editID: Types.EditID,
  parentPath: Types.Path,
|}>
type _FavoriteIgnoreErrorPayload = $ReadOnly<{|
  path: Types.Path,
  error: Types.FsError,
|}>
type _FavoriteIgnorePayload = $ReadOnly<{|path: Types.Path|}>
type _FavoritesLoadPayload = void
type _FavoritesLoadedPayload = $ReadOnly<{|
  private: I.Map<string, Types.Tlf>,
  public: I.Map<string, Types.Tlf>,
  team: I.Map<string, Types.Tlf>,
|}>
type _FilePreviewLoadPayload = $ReadOnly<{|
  path: Types.Path,
  identifyBehavior?: ?RPCTypes.TLFIdentifyBehavior,
|}>
type _FilePreviewLoadedPayload = $ReadOnly<{|
  path: Types.Path,
  meta: Types.PathItem,
|}>
type _FolderListLoadPayload = $ReadOnly<{|
  path: Types.Path,
  refreshTag?: Types.RefreshTag,
|}>
type _FolderListLoadedPayload = $ReadOnly<{|
  path: Types.Path,
  pathItems: I.Map<Types.Path, Types.PathItem>,
|}>
type _FsErrorPayload = $ReadOnly<{|error: Types.FsError|}>
type _FuseStatusPayload = void
type _FuseStatusResultPayload = $ReadOnly<{|
  prevStatus: ?RPCTypes.FuseStatus,
  status: RPCTypes.FuseStatus,
|}>
type _InstallFusePayload = void
type _InstallFuseResultPayload = $ReadOnly<{|kextPermissionError: boolean|}>
type _InstallKBFSPayload = void
type _JournalUpdatePayload = $ReadOnly<{|
  syncingPaths: Array<Types.Path>,
  totalSyncingBytes: number,
  endEstimate?: ?number,
|}>
type _LetResetUserBackInPayload = $ReadOnly<{|
  id: RPCTypes.TeamID,
  username: string,
|}>
type _LoadingPathPayload = $ReadOnly<{|
  path: Types.Path,
  id: string,
  done: boolean,
|}>
type _LocalHTTPServerInfoPayload = $ReadOnly<{|
  address: string,
  token: string,
|}>
type _MimeTypeLoadPayload = $ReadOnly<{|
  path: Types.Path,
  refreshTag?: Types.RefreshTag,
|}>
type _MimeTypeLoadedPayload = $ReadOnly<{|
  path: Types.Path,
  mimeType: Types.Mime,
|}>
type _MoveOrCopyOpenPayload = $ReadOnly<{|
  routePath: I.List<string>,
  path: Types.Path,
  currentIndex: number,
|}>
type _MovePayload = $ReadOnly<{|destinationParentPath: Types.Path|}>
type _NewFolderNamePayload = $ReadOnly<{|
  editID: Types.EditID,
  name: string,
|}>
type _NewFolderRowPayload = $ReadOnly<{|parentPath: Types.Path|}>
type _NotifySyncActivityPayload = void
type _NotifyTlfUpdatePayload = $ReadOnly<{|tlfPath: Types.Path|}>
type _OpenAndUploadPayload = $ReadOnly<{|
  type: Types.OpenDialogType,
  parentPath: Types.Path,
|}>
type _OpenFilesFromWidgetPayload = $ReadOnly<{|
  path: Types.Path,
  type: Types.PathType,
|}>
type _OpenLocalPathInSystemFileManagerPayload = $ReadOnly<{|path: string|}>
type _OpenPathInFilesTabPayload = $ReadOnly<{|
  path: Types.Path,
  routePath?: I.List<string>,
|}>
type _OpenPathInSystemFileManagerPayload = $ReadOnly<{|path: Types.Path|}>
type _OpenPathItemPayload = $ReadOnly<{|
  path: Types.Path,
  routePath: I.List<string>,
|}>
type _OpenSecurityPreferencesPayload = void
type _PickAndUploadPayload = $ReadOnly<{|
  type: Types.MobilePickType,
  parentPath: Types.Path,
|}>
type _PlaceholderActionPayload = void
type _RefreshLocalHTTPServerInfoPayload = void
type _SaveMediaPayload = $ReadOnly<{|
  path: Types.Path,
  key: string,
|}>
type _SetFlagsPayload = $ReadOnly<{|
  kbfsOpening?: boolean,
  kbfsInstalling?: boolean,
  fuseInstalling?: boolean,
  kextPermissionError?: boolean,
  securityPrefsPrompted?: boolean,
  showBanner?: boolean,
|}>
type _SetMoveOrCopyDestinationParentPathPayload = $ReadOnly<{|
  index: number,
  path: Types.Path,
|}>
type _SetMoveOrCopySourcePayload = $ReadOnly<{|path: Types.Path|}>
type _ShareNativePayload = $ReadOnly<{|
  path: Types.Path,
  key: string,
|}>
type _ShowMoveOrCopyPayload = $ReadOnly<{|initialDestinationParentPath: Types.Path|}>
type _SortSettingPayload = $ReadOnly<{|
  path: Types.Path,
  sortSetting: Types.SortSetting,
|}>
type _UninstallKBFSConfirmPayload = void
type _UploadPayload = $ReadOnly<{|
  parentPath: Types.Path,
  localPath: string,
|}>
type _UploadStartedPayload = $ReadOnly<{|path: Types.Path|}>
type _UploadWritingSuccessPayload = $ReadOnly<{|path: Types.Path|}>
type _UserFileEditsLoadPayload = void
type _UserFileEditsLoadedPayload = $ReadOnly<{|tlfUpdates: Types.UserTlfUpdates|}>

// Action Creators
export const createCancelDownload = (payload: _CancelDownloadPayload) => ({payload, type: cancelDownload})
export const createCancelMoveOrCopy = (payload: _CancelMoveOrCopyPayload) => ({payload, type: cancelMoveOrCopy})
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
export const createEditSuccess = (payload: _EditSuccessPayload) => ({payload, type: editSuccess})
export const createFavoriteIgnore = (payload: _FavoriteIgnorePayload) => ({payload, type: favoriteIgnore})
export const createFavoriteIgnoreError = (payload: _FavoriteIgnoreErrorPayload) => ({payload, type: favoriteIgnoreError})
export const createFavoritesLoad = (payload: _FavoritesLoadPayload) => ({payload, type: favoritesLoad})
export const createFavoritesLoaded = (payload: _FavoritesLoadedPayload) => ({payload, type: favoritesLoaded})
export const createFilePreviewLoad = (payload: _FilePreviewLoadPayload) => ({payload, type: filePreviewLoad})
export const createFilePreviewLoaded = (payload: _FilePreviewLoadedPayload) => ({payload, type: filePreviewLoaded})
export const createFolderListLoad = (payload: _FolderListLoadPayload) => ({payload, type: folderListLoad})
export const createFolderListLoaded = (payload: _FolderListLoadedPayload) => ({payload, type: folderListLoaded})
export const createFsError = (payload: _FsErrorPayload) => ({payload, type: fsError})
export const createFuseStatus = (payload: _FuseStatusPayload) => ({payload, type: fuseStatus})
export const createFuseStatusResult = (payload: _FuseStatusResultPayload) => ({payload, type: fuseStatusResult})
export const createInstallFuse = (payload: _InstallFusePayload) => ({payload, type: installFuse})
export const createInstallFuseResult = (payload: _InstallFuseResultPayload) => ({payload, type: installFuseResult})
export const createInstallKBFS = (payload: _InstallKBFSPayload) => ({payload, type: installKBFS})
export const createJournalUpdate = (payload: _JournalUpdatePayload) => ({payload, type: journalUpdate})
export const createLetResetUserBackIn = (payload: _LetResetUserBackInPayload) => ({payload, type: letResetUserBackIn})
export const createLoadingPath = (payload: _LoadingPathPayload) => ({payload, type: loadingPath})
export const createLocalHTTPServerInfo = (payload: _LocalHTTPServerInfoPayload) => ({payload, type: localHTTPServerInfo})
export const createMimeTypeLoad = (payload: _MimeTypeLoadPayload) => ({payload, type: mimeTypeLoad})
export const createMimeTypeLoaded = (payload: _MimeTypeLoadedPayload) => ({payload, type: mimeTypeLoaded})
export const createMove = (payload: _MovePayload) => ({payload, type: move})
export const createMoveOrCopyOpen = (payload: _MoveOrCopyOpenPayload) => ({payload, type: moveOrCopyOpen})
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
export const createPickAndUpload = (payload: _PickAndUploadPayload) => ({payload, type: pickAndUpload})
export const createPlaceholderAction = (payload: _PlaceholderActionPayload) => ({payload, type: placeholderAction})
export const createRefreshLocalHTTPServerInfo = (payload: _RefreshLocalHTTPServerInfoPayload) => ({payload, type: refreshLocalHTTPServerInfo})
export const createSaveMedia = (payload: _SaveMediaPayload) => ({payload, type: saveMedia})
export const createSetFlags = (payload: _SetFlagsPayload) => ({payload, type: setFlags})
export const createSetMoveOrCopyDestinationParentPath = (payload: _SetMoveOrCopyDestinationParentPathPayload) => ({payload, type: setMoveOrCopyDestinationParentPath})
export const createSetMoveOrCopySource = (payload: _SetMoveOrCopySourcePayload) => ({payload, type: setMoveOrCopySource})
export const createShareNative = (payload: _ShareNativePayload) => ({payload, type: shareNative})
export const createShowMoveOrCopy = (payload: _ShowMoveOrCopyPayload) => ({payload, type: showMoveOrCopy})
export const createSortSetting = (payload: _SortSettingPayload) => ({payload, type: sortSetting})
export const createUninstallKBFSConfirm = (payload: _UninstallKBFSConfirmPayload) => ({payload, type: uninstallKBFSConfirm})
export const createUpload = (payload: _UploadPayload) => ({payload, type: upload})
export const createUploadStarted = (payload: _UploadStartedPayload) => ({payload, type: uploadStarted})
export const createUploadWritingSuccess = (payload: _UploadWritingSuccessPayload) => ({payload, type: uploadWritingSuccess})
export const createUserFileEditsLoad = (payload: _UserFileEditsLoadPayload) => ({payload, type: userFileEditsLoad})
export const createUserFileEditsLoaded = (payload: _UserFileEditsLoadedPayload) => ({payload, type: userFileEditsLoaded})

// Action Payloads
export type CancelDownloadPayload = $Call<typeof createCancelDownload, _CancelDownloadPayload>
export type CancelMoveOrCopyPayload = $Call<typeof createCancelMoveOrCopy, _CancelMoveOrCopyPayload>
export type CommitEditPayload = $Call<typeof createCommitEdit, _CommitEditPayload>
export type CopyPayload = $Call<typeof createCopy, _CopyPayload>
export type DeleteFilePayload = $Call<typeof createDeleteFile, _DeleteFilePayload>
export type DiscardEditPayload = $Call<typeof createDiscardEdit, _DiscardEditPayload>
export type DismissDownloadPayload = $Call<typeof createDismissDownload, _DismissDownloadPayload>
export type DismissFsErrorPayload = $Call<typeof createDismissFsError, _DismissFsErrorPayload>
export type DownloadPayload = $Call<typeof createDownload, _DownloadPayload>
export type DownloadProgressPayload = $Call<typeof createDownloadProgress, _DownloadProgressPayload>
export type DownloadStartedPayload = $Call<typeof createDownloadStarted, _DownloadStartedPayload>
export type DownloadSuccessPayload = $Call<typeof createDownloadSuccess, _DownloadSuccessPayload>
export type EditSuccessPayload = $Call<typeof createEditSuccess, _EditSuccessPayload>
export type FavoriteIgnoreErrorPayload = $Call<typeof createFavoriteIgnoreError, _FavoriteIgnoreErrorPayload>
export type FavoriteIgnorePayload = $Call<typeof createFavoriteIgnore, _FavoriteIgnorePayload>
export type FavoritesLoadPayload = $Call<typeof createFavoritesLoad, _FavoritesLoadPayload>
export type FavoritesLoadedPayload = $Call<typeof createFavoritesLoaded, _FavoritesLoadedPayload>
export type FilePreviewLoadPayload = $Call<typeof createFilePreviewLoad, _FilePreviewLoadPayload>
export type FilePreviewLoadedPayload = $Call<typeof createFilePreviewLoaded, _FilePreviewLoadedPayload>
export type FolderListLoadPayload = $Call<typeof createFolderListLoad, _FolderListLoadPayload>
export type FolderListLoadedPayload = $Call<typeof createFolderListLoaded, _FolderListLoadedPayload>
export type FsErrorPayload = $Call<typeof createFsError, _FsErrorPayload>
export type FuseStatusPayload = $Call<typeof createFuseStatus, _FuseStatusPayload>
export type FuseStatusResultPayload = $Call<typeof createFuseStatusResult, _FuseStatusResultPayload>
export type InstallFusePayload = $Call<typeof createInstallFuse, _InstallFusePayload>
export type InstallFuseResultPayload = $Call<typeof createInstallFuseResult, _InstallFuseResultPayload>
export type InstallKBFSPayload = $Call<typeof createInstallKBFS, _InstallKBFSPayload>
export type JournalUpdatePayload = $Call<typeof createJournalUpdate, _JournalUpdatePayload>
export type LetResetUserBackInPayload = $Call<typeof createLetResetUserBackIn, _LetResetUserBackInPayload>
export type LoadingPathPayload = $Call<typeof createLoadingPath, _LoadingPathPayload>
export type LocalHTTPServerInfoPayload = $Call<typeof createLocalHTTPServerInfo, _LocalHTTPServerInfoPayload>
export type MimeTypeLoadPayload = $Call<typeof createMimeTypeLoad, _MimeTypeLoadPayload>
export type MimeTypeLoadedPayload = $Call<typeof createMimeTypeLoaded, _MimeTypeLoadedPayload>
export type MoveOrCopyOpenPayload = $Call<typeof createMoveOrCopyOpen, _MoveOrCopyOpenPayload>
export type MovePayload = $Call<typeof createMove, _MovePayload>
export type NewFolderNamePayload = $Call<typeof createNewFolderName, _NewFolderNamePayload>
export type NewFolderRowPayload = $Call<typeof createNewFolderRow, _NewFolderRowPayload>
export type NotifySyncActivityPayload = $Call<typeof createNotifySyncActivity, _NotifySyncActivityPayload>
export type NotifyTlfUpdatePayload = $Call<typeof createNotifyTlfUpdate, _NotifyTlfUpdatePayload>
export type OpenAndUploadPayload = $Call<typeof createOpenAndUpload, _OpenAndUploadPayload>
export type OpenFilesFromWidgetPayload = $Call<typeof createOpenFilesFromWidget, _OpenFilesFromWidgetPayload>
export type OpenLocalPathInSystemFileManagerPayload = $Call<typeof createOpenLocalPathInSystemFileManager, _OpenLocalPathInSystemFileManagerPayload>
export type OpenPathInFilesTabPayload = $Call<typeof createOpenPathInFilesTab, _OpenPathInFilesTabPayload>
export type OpenPathInSystemFileManagerPayload = $Call<typeof createOpenPathInSystemFileManager, _OpenPathInSystemFileManagerPayload>
export type OpenPathItemPayload = $Call<typeof createOpenPathItem, _OpenPathItemPayload>
export type OpenSecurityPreferencesPayload = $Call<typeof createOpenSecurityPreferences, _OpenSecurityPreferencesPayload>
export type PickAndUploadPayload = $Call<typeof createPickAndUpload, _PickAndUploadPayload>
export type PlaceholderActionPayload = $Call<typeof createPlaceholderAction, _PlaceholderActionPayload>
export type RefreshLocalHTTPServerInfoPayload = $Call<typeof createRefreshLocalHTTPServerInfo, _RefreshLocalHTTPServerInfoPayload>
export type SaveMediaPayload = $Call<typeof createSaveMedia, _SaveMediaPayload>
export type SetFlagsPayload = $Call<typeof createSetFlags, _SetFlagsPayload>
export type SetMoveOrCopyDestinationParentPathPayload = $Call<typeof createSetMoveOrCopyDestinationParentPath, _SetMoveOrCopyDestinationParentPathPayload>
export type SetMoveOrCopySourcePayload = $Call<typeof createSetMoveOrCopySource, _SetMoveOrCopySourcePayload>
export type ShareNativePayload = $Call<typeof createShareNative, _ShareNativePayload>
export type ShowMoveOrCopyPayload = $Call<typeof createShowMoveOrCopy, _ShowMoveOrCopyPayload>
export type SortSettingPayload = $Call<typeof createSortSetting, _SortSettingPayload>
export type UninstallKBFSConfirmPayload = $Call<typeof createUninstallKBFSConfirm, _UninstallKBFSConfirmPayload>
export type UploadPayload = $Call<typeof createUpload, _UploadPayload>
export type UploadStartedPayload = $Call<typeof createUploadStarted, _UploadStartedPayload>
export type UploadWritingSuccessPayload = $Call<typeof createUploadWritingSuccess, _UploadWritingSuccessPayload>
export type UserFileEditsLoadPayload = $Call<typeof createUserFileEditsLoad, _UserFileEditsLoadPayload>
export type UserFileEditsLoadedPayload = $Call<typeof createUserFileEditsLoaded, _UserFileEditsLoadedPayload>

// All Actions
// prettier-ignore
export type Actions =
  | CancelDownloadPayload
  | CancelMoveOrCopyPayload
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
  | EditSuccessPayload
  | FavoriteIgnoreErrorPayload
  | FavoriteIgnorePayload
  | FavoritesLoadPayload
  | FavoritesLoadedPayload
  | FilePreviewLoadPayload
  | FilePreviewLoadedPayload
  | FolderListLoadPayload
  | FolderListLoadedPayload
  | FsErrorPayload
  | FuseStatusPayload
  | FuseStatusResultPayload
  | InstallFusePayload
  | InstallFuseResultPayload
  | InstallKBFSPayload
  | JournalUpdatePayload
  | LetResetUserBackInPayload
  | LoadingPathPayload
  | LocalHTTPServerInfoPayload
  | MimeTypeLoadPayload
  | MimeTypeLoadedPayload
  | MoveOrCopyOpenPayload
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
  | PickAndUploadPayload
  | PlaceholderActionPayload
  | RefreshLocalHTTPServerInfoPayload
  | SaveMediaPayload
  | SetFlagsPayload
  | SetMoveOrCopyDestinationParentPathPayload
  | SetMoveOrCopySourcePayload
  | ShareNativePayload
  | ShowMoveOrCopyPayload
  | SortSettingPayload
  | UninstallKBFSConfirmPayload
  | UploadPayload
  | UploadStartedPayload
  | UploadWritingSuccessPayload
  | UserFileEditsLoadPayload
  | UserFileEditsLoadedPayload
  | {type: 'common:resetStore', payload: void}
