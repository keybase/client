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
export const commitEdit = 'fs:commitEdit'
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
export const localHTTPServerInfo = 'fs:localHTTPServerInfo'
export const mimeTypeLoad = 'fs:mimeTypeLoad'
export const mimeTypeLoaded = 'fs:mimeTypeLoaded'
export const newFolderName = 'fs:newFolderName'
export const newFolderRow = 'fs:newFolderRow'
export const notifySyncActivity = 'fs:notifySyncActivity'
export const notifyTlfUpdate = 'fs:notifyTlfUpdate'
export const openAndUpload = 'fs:openAndUpload'
export const openFilesFromWidget = 'fs:openFilesFromWidget'
export const openInFileUI = 'fs:openInFileUI'
export const openPathItem = 'fs:openPathItem'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const pickAndUpload = 'fs:pickAndUpload'
export const placeholderAction = 'fs:placeholderAction'
export const refreshLocalHTTPServerInfo = 'fs:refreshLocalHTTPServerInfo'
export const saveMedia = 'fs:saveMedia'
export const setFlags = 'fs:setFlags'
export const shareNative = 'fs:shareNative'
export const sortSetting = 'fs:sortSetting'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'
export const upload = 'fs:upload'
export const uploadStarted = 'fs:uploadStarted'
export const uploadWritingSuccess = 'fs:uploadWritingSuccess'
export const userFileEditsLoad = 'fs:userFileEditsLoad'
export const userFileEditsLoaded = 'fs:userFileEditsLoaded'

// Payload Types
type _CancelDownloadPayload = $ReadOnly<{|key: string|}>
type _CommitEditPayload = $ReadOnly<{|editID: Types.EditID|}>
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
type _FilePreviewLoadPayload = $ReadOnly<{|path: Types.Path|}>
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
  mimeType: string,
|}>
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
type _OpenFilesFromWidgetPayload = $ReadOnly<{|path?: Types.Path|}>
type _OpenInFileUIPayload = $ReadOnly<{|path?: string|}>
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
  securityPrefsPropmted?: boolean,
  showBanner?: boolean,
  syncing?: boolean,
|}>
type _ShareNativePayload = $ReadOnly<{|
  path: Types.Path,
  key: string,
|}>
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
type _UserFileEditsLoadedPayload = $ReadOnly<{|writerEdits: Array<RPCTypes.FSFolderEditHistory>|}>

// Action Creators
export const createCancelDownload = (payload: _CancelDownloadPayload) => ({error: false, payload, type: cancelDownload})
export const createCommitEdit = (payload: _CommitEditPayload) => ({error: false, payload, type: commitEdit})
export const createDiscardEdit = (payload: _DiscardEditPayload) => ({error: false, payload, type: discardEdit})
export const createDismissDownload = (payload: _DismissDownloadPayload) => ({error: false, payload, type: dismissDownload})
export const createDismissFsError = (payload: _DismissFsErrorPayload) => ({error: false, payload, type: dismissFsError})
export const createDownload = (payload: _DownloadPayload) => ({error: false, payload, type: download})
export const createDownloadProgress = (payload: _DownloadProgressPayload) => ({error: false, payload, type: downloadProgress})
export const createDownloadStarted = (payload: _DownloadStartedPayload) => ({error: false, payload, type: downloadStarted})
export const createDownloadSuccess = (payload: _DownloadSuccessPayload) => ({error: false, payload, type: downloadSuccess})
export const createEditSuccess = (payload: _EditSuccessPayload) => ({error: false, payload, type: editSuccess})
export const createFavoriteIgnore = (payload: _FavoriteIgnorePayload) => ({error: false, payload, type: favoriteIgnore})
export const createFavoriteIgnoreError = (payload: _FavoriteIgnoreErrorPayload) => ({error: false, payload, type: favoriteIgnoreError})
export const createFavoritesLoad = (payload: _FavoritesLoadPayload) => ({error: false, payload, type: favoritesLoad})
export const createFavoritesLoaded = (payload: _FavoritesLoadedPayload) => ({error: false, payload, type: favoritesLoaded})
export const createFilePreviewLoad = (payload: _FilePreviewLoadPayload) => ({error: false, payload, type: filePreviewLoad})
export const createFilePreviewLoaded = (payload: _FilePreviewLoadedPayload) => ({error: false, payload, type: filePreviewLoaded})
export const createFolderListLoad = (payload: _FolderListLoadPayload) => ({error: false, payload, type: folderListLoad})
export const createFolderListLoaded = (payload: _FolderListLoadedPayload) => ({error: false, payload, type: folderListLoaded})
export const createFsError = (payload: _FsErrorPayload) => ({error: false, payload, type: fsError})
export const createFuseStatus = (payload: _FuseStatusPayload) => ({error: false, payload, type: fuseStatus})
export const createFuseStatusResult = (payload: _FuseStatusResultPayload) => ({error: false, payload, type: fuseStatusResult})
export const createInstallFuse = (payload: _InstallFusePayload) => ({error: false, payload, type: installFuse})
export const createInstallFuseResult = (payload: _InstallFuseResultPayload) => ({error: false, payload, type: installFuseResult})
export const createInstallKBFS = (payload: _InstallKBFSPayload) => ({error: false, payload, type: installKBFS})
export const createJournalUpdate = (payload: _JournalUpdatePayload) => ({error: false, payload, type: journalUpdate})
export const createLetResetUserBackIn = (payload: _LetResetUserBackInPayload) => ({error: false, payload, type: letResetUserBackIn})
export const createLocalHTTPServerInfo = (payload: _LocalHTTPServerInfoPayload) => ({error: false, payload, type: localHTTPServerInfo})
export const createMimeTypeLoad = (payload: _MimeTypeLoadPayload) => ({error: false, payload, type: mimeTypeLoad})
export const createMimeTypeLoaded = (payload: _MimeTypeLoadedPayload) => ({error: false, payload, type: mimeTypeLoaded})
export const createNewFolderName = (payload: _NewFolderNamePayload) => ({error: false, payload, type: newFolderName})
export const createNewFolderRow = (payload: _NewFolderRowPayload) => ({error: false, payload, type: newFolderRow})
export const createNotifySyncActivity = (payload: _NotifySyncActivityPayload) => ({error: false, payload, type: notifySyncActivity})
export const createNotifyTlfUpdate = (payload: _NotifyTlfUpdatePayload) => ({error: false, payload, type: notifyTlfUpdate})
export const createOpenAndUpload = (payload: _OpenAndUploadPayload) => ({error: false, payload, type: openAndUpload})
export const createOpenFilesFromWidget = (payload: _OpenFilesFromWidgetPayload) => ({error: false, payload, type: openFilesFromWidget})
export const createOpenInFileUI = (payload: _OpenInFileUIPayload) => ({error: false, payload, type: openInFileUI})
export const createOpenPathItem = (payload: _OpenPathItemPayload) => ({error: false, payload, type: openPathItem})
export const createOpenSecurityPreferences = (payload: _OpenSecurityPreferencesPayload) => ({error: false, payload, type: openSecurityPreferences})
export const createPickAndUpload = (payload: _PickAndUploadPayload) => ({error: false, payload, type: pickAndUpload})
export const createPlaceholderAction = (payload: _PlaceholderActionPayload) => ({error: false, payload, type: placeholderAction})
export const createRefreshLocalHTTPServerInfo = (payload: _RefreshLocalHTTPServerInfoPayload) => ({error: false, payload, type: refreshLocalHTTPServerInfo})
export const createSaveMedia = (payload: _SaveMediaPayload) => ({error: false, payload, type: saveMedia})
export const createSetFlags = (payload: _SetFlagsPayload) => ({error: false, payload, type: setFlags})
export const createShareNative = (payload: _ShareNativePayload) => ({error: false, payload, type: shareNative})
export const createSortSetting = (payload: _SortSettingPayload) => ({error: false, payload, type: sortSetting})
export const createUninstallKBFSConfirm = (payload: _UninstallKBFSConfirmPayload) => ({error: false, payload, type: uninstallKBFSConfirm})
export const createUpload = (payload: _UploadPayload) => ({error: false, payload, type: upload})
export const createUploadStarted = (payload: _UploadStartedPayload) => ({error: false, payload, type: uploadStarted})
export const createUploadWritingSuccess = (payload: _UploadWritingSuccessPayload) => ({error: false, payload, type: uploadWritingSuccess})
export const createUserFileEditsLoad = (payload: _UserFileEditsLoadPayload) => ({error: false, payload, type: userFileEditsLoad})
export const createUserFileEditsLoaded = (payload: _UserFileEditsLoadedPayload) => ({error: false, payload, type: userFileEditsLoaded})

// Action Payloads
export type CancelDownloadPayload = $Call<typeof createCancelDownload, _CancelDownloadPayload>
export type CommitEditPayload = $Call<typeof createCommitEdit, _CommitEditPayload>
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
export type LocalHTTPServerInfoPayload = $Call<typeof createLocalHTTPServerInfo, _LocalHTTPServerInfoPayload>
export type MimeTypeLoadPayload = $Call<typeof createMimeTypeLoad, _MimeTypeLoadPayload>
export type MimeTypeLoadedPayload = $Call<typeof createMimeTypeLoaded, _MimeTypeLoadedPayload>
export type NewFolderNamePayload = $Call<typeof createNewFolderName, _NewFolderNamePayload>
export type NewFolderRowPayload = $Call<typeof createNewFolderRow, _NewFolderRowPayload>
export type NotifySyncActivityPayload = $Call<typeof createNotifySyncActivity, _NotifySyncActivityPayload>
export type NotifyTlfUpdatePayload = $Call<typeof createNotifyTlfUpdate, _NotifyTlfUpdatePayload>
export type OpenAndUploadPayload = $Call<typeof createOpenAndUpload, _OpenAndUploadPayload>
export type OpenFilesFromWidgetPayload = $Call<typeof createOpenFilesFromWidget, _OpenFilesFromWidgetPayload>
export type OpenInFileUIPayload = $Call<typeof createOpenInFileUI, _OpenInFileUIPayload>
export type OpenPathItemPayload = $Call<typeof createOpenPathItem, _OpenPathItemPayload>
export type OpenSecurityPreferencesPayload = $Call<typeof createOpenSecurityPreferences, _OpenSecurityPreferencesPayload>
export type PickAndUploadPayload = $Call<typeof createPickAndUpload, _PickAndUploadPayload>
export type PlaceholderActionPayload = $Call<typeof createPlaceholderAction, _PlaceholderActionPayload>
export type RefreshLocalHTTPServerInfoPayload = $Call<typeof createRefreshLocalHTTPServerInfo, _RefreshLocalHTTPServerInfoPayload>
export type SaveMediaPayload = $Call<typeof createSaveMedia, _SaveMediaPayload>
export type SetFlagsPayload = $Call<typeof createSetFlags, _SetFlagsPayload>
export type ShareNativePayload = $Call<typeof createShareNative, _ShareNativePayload>
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
  | CommitEditPayload
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
  | LocalHTTPServerInfoPayload
  | MimeTypeLoadPayload
  | MimeTypeLoadedPayload
  | NewFolderNamePayload
  | NewFolderRowPayload
  | NotifySyncActivityPayload
  | NotifyTlfUpdatePayload
  | OpenAndUploadPayload
  | OpenFilesFromWidgetPayload
  | OpenInFileUIPayload
  | OpenPathItemPayload
  | OpenSecurityPreferencesPayload
  | PickAndUploadPayload
  | PlaceholderActionPayload
  | RefreshLocalHTTPServerInfoPayload
  | SaveMediaPayload
  | SetFlagsPayload
  | ShareNativePayload
  | SortSettingPayload
  | UninstallKBFSConfirmPayload
  | UploadPayload
  | UploadStartedPayload
  | UploadWritingSuccessPayload
  | UserFileEditsLoadPayload
  | UserFileEditsLoadedPayload
  | {type: 'common:resetStore', payload: void}
