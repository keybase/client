// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/fs'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer
export const cancelDownload = 'fs:cancelDownload'
export const commitEdit = 'fs:commitEdit'
export const discardEdit = 'fs:discardEdit'
export const dismissDownload = 'fs:dismissDownload'
export const download = 'fs:download'
export const downloadFinished = 'fs:downloadFinished'
export const downloadProgress = 'fs:downloadProgress'
export const downloadStarted = 'fs:downloadStarted'
export const editFailed = 'fs:editFailed'
export const editSuccess = 'fs:editSuccess'
export const favoriteIgnore = 'fs:favoriteIgnore'
export const favoriteIgnoreError = 'fs:favoriteIgnoreError'
export const favoritesLoad = 'fs:favoritesLoad'
export const favoritesLoaded = 'fs:favoritesLoaded'
export const fileActionPopup = 'fs:fileActionPopup'
export const filePreviewLoad = 'fs:filePreviewLoad'
export const filePreviewLoaded = 'fs:filePreviewLoaded'
export const folderListLoad = 'fs:folderListLoad'
export const folderListLoaded = 'fs:folderListLoaded'
export const fsActivity = 'fs:fsActivity'
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
export const openFinderPopup = 'fs:openFinderPopup'
export const openInFileUI = 'fs:openInFileUI'
export const openPathItem = 'fs:openPathItem'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const pickAndUpload = 'fs:pickAndUpload'
export const refreshLocalHTTPServerInfo = 'fs:refreshLocalHTTPServerInfo'
export const saveMedia = 'fs:saveMedia'
export const setFlags = 'fs:setFlags'
export const setupFSHandlers = 'fs:setupFSHandlers'
export const shareNative = 'fs:shareNative'
export const sortSetting = 'fs:sortSetting'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'
export const upload = 'fs:upload'
export const uploadStarted = 'fs:uploadStarted'
export const uploadWritingFinished = 'fs:uploadWritingFinished'

// Payload Types
type _CancelDownloadPayload = $ReadOnly<{|key: string|}>
type _CommitEditPayload = $ReadOnly<{|editID: Types.EditID|}>
type _DiscardEditPayload = $ReadOnly<{|editID: Types.EditID|}>
type _DismissDownloadPayload = $ReadOnly<{|key: string|}>
type _DownloadFinishedPayload = $ReadOnly<{|
  key: string,
  error?: string,
|}>
type _DownloadPayload = $ReadOnly<{|
  intent: Types.DownloadIntent,
  path: Types.Path,
  localPath?: string,
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
type _EditFailedPayload = $ReadOnly<{|editID: Types.EditID|}>
type _EditSuccessPayload = $ReadOnly<{|editID: Types.EditID|}>
type _FavoriteIgnoreErrorPayload = $ReadOnly<{|
  path: Types.Path,
  errorText: string,
|}>
type _FavoriteIgnorePayload = $ReadOnly<{|path: Types.Path|}>
type _FavoritesLoadPayload = void
type _FavoritesLoadedPayload = $ReadOnly<{|folders: I.Map<Types.Path, Types.FavoriteItem>|}>
type _FileActionPopupPayload = $ReadOnly<{|
  path: Types.Path,
  type: Types.PathType,
  targetRect: ?ClientRect,
  routePath: I.List<string>,
|}>
type _FilePreviewLoadPayload = $ReadOnly<{|path: Types.Path|}>
type _FilePreviewLoadedPayload = $ReadOnly<{|
  path: Types.Path,
  meta: Types.PathItem,
|}>
type _FolderListLoadPayload = $ReadOnly<{|path: Types.Path|}>
type _FolderListLoadedPayload = $ReadOnly<{|
  path: Types.Path,
  pathItems: I.Map<Types.Path, Types.PathItem>,
|}>
type _FsActivityPayload = void
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
type _MimeTypeLoadPayload = $ReadOnly<{|path: Types.Path|}>
type _MimeTypeLoadedPayload = $ReadOnly<{|
  path: Types.Path,
  mimeType: string,
|}>
type _NewFolderNamePayload = $ReadOnly<{|
  editID: Types.EditID,
  name: string,
|}>
type _NewFolderRowPayload = $ReadOnly<{|parentPath: Types.Path|}>
type _OpenFinderPopupPayload = $ReadOnly<{|
  targetRect: ?ClientRect,
  routePath: I.List<string>,
|}>
type _OpenInFileUIPayload = $ReadOnly<{|path?: string|}>
type _OpenPathItemPayload = $ReadOnly<{|
  path: Types.Path,
  routePath: I.List<string>,
|}>
type _OpenSecurityPreferencesPayload = void
type _PickAndUploadPayload = $ReadOnly<{|
  type: Types.OpenDialogType,
  parentPath: Types.Path,
|}>
type _RefreshLocalHTTPServerInfoPayload = void
type _SaveMediaPayload = $ReadOnly<{|
  path: Types.Path,
  routePath?: I.List<string>,
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
type _SetupFSHandlersPayload = void
type _ShareNativePayload = $ReadOnly<{|
  path: Types.Path,
  routePath?: I.List<string>,
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
type _UploadWritingFinishedPayload = $ReadOnly<{|
  path: Types.Path,
  error?: string,
|}>

// Action Creators
export const createCancelDownload = (payload: _CancelDownloadPayload) => ({error: false, payload, type: cancelDownload})
export const createCommitEdit = (payload: _CommitEditPayload) => ({error: false, payload, type: commitEdit})
export const createDiscardEdit = (payload: _DiscardEditPayload) => ({error: false, payload, type: discardEdit})
export const createDismissDownload = (payload: _DismissDownloadPayload) => ({error: false, payload, type: dismissDownload})
export const createDownload = (payload: _DownloadPayload) => ({error: false, payload, type: download})
export const createDownloadFinished = (payload: _DownloadFinishedPayload) => ({error: false, payload, type: downloadFinished})
export const createDownloadProgress = (payload: _DownloadProgressPayload) => ({error: false, payload, type: downloadProgress})
export const createDownloadStarted = (payload: _DownloadStartedPayload) => ({error: false, payload, type: downloadStarted})
export const createEditFailed = (payload: _EditFailedPayload) => ({error: false, payload, type: editFailed})
export const createEditSuccess = (payload: _EditSuccessPayload) => ({error: false, payload, type: editSuccess})
export const createFavoriteIgnore = (payload: _FavoriteIgnorePayload) => ({error: false, payload, type: favoriteIgnore})
export const createFavoriteIgnoreError = (payload: _FavoriteIgnoreErrorPayload) => ({error: false, payload, type: favoriteIgnoreError})
export const createFavoritesLoad = (payload: _FavoritesLoadPayload) => ({error: false, payload, type: favoritesLoad})
export const createFavoritesLoaded = (payload: _FavoritesLoadedPayload) => ({error: false, payload, type: favoritesLoaded})
export const createFileActionPopup = (payload: _FileActionPopupPayload) => ({error: false, payload, type: fileActionPopup})
export const createFilePreviewLoad = (payload: _FilePreviewLoadPayload) => ({error: false, payload, type: filePreviewLoad})
export const createFilePreviewLoaded = (payload: _FilePreviewLoadedPayload) => ({error: false, payload, type: filePreviewLoaded})
export const createFolderListLoad = (payload: _FolderListLoadPayload) => ({error: false, payload, type: folderListLoad})
export const createFolderListLoaded = (payload: _FolderListLoadedPayload) => ({error: false, payload, type: folderListLoaded})
export const createFsActivity = (payload: _FsActivityPayload) => ({error: false, payload, type: fsActivity})
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
export const createOpenFinderPopup = (payload: _OpenFinderPopupPayload) => ({error: false, payload, type: openFinderPopup})
export const createOpenInFileUI = (payload: _OpenInFileUIPayload) => ({error: false, payload, type: openInFileUI})
export const createOpenPathItem = (payload: _OpenPathItemPayload) => ({error: false, payload, type: openPathItem})
export const createOpenSecurityPreferences = (payload: _OpenSecurityPreferencesPayload) => ({error: false, payload, type: openSecurityPreferences})
export const createPickAndUpload = (payload: _PickAndUploadPayload) => ({error: false, payload, type: pickAndUpload})
export const createRefreshLocalHTTPServerInfo = (payload: _RefreshLocalHTTPServerInfoPayload) => ({error: false, payload, type: refreshLocalHTTPServerInfo})
export const createSaveMedia = (payload: _SaveMediaPayload) => ({error: false, payload, type: saveMedia})
export const createSetFlags = (payload: _SetFlagsPayload) => ({error: false, payload, type: setFlags})
export const createSetupFSHandlers = (payload: _SetupFSHandlersPayload) => ({error: false, payload, type: setupFSHandlers})
export const createShareNative = (payload: _ShareNativePayload) => ({error: false, payload, type: shareNative})
export const createSortSetting = (payload: _SortSettingPayload) => ({error: false, payload, type: sortSetting})
export const createUninstallKBFSConfirm = (payload: _UninstallKBFSConfirmPayload) => ({error: false, payload, type: uninstallKBFSConfirm})
export const createUpload = (payload: _UploadPayload) => ({error: false, payload, type: upload})
export const createUploadStarted = (payload: _UploadStartedPayload) => ({error: false, payload, type: uploadStarted})
export const createUploadWritingFinished = (payload: _UploadWritingFinishedPayload) => ({error: false, payload, type: uploadWritingFinished})

// Action Payloads
export type CancelDownloadPayload = $Call<typeof createCancelDownload, _CancelDownloadPayload>
export type CommitEditPayload = $Call<typeof createCommitEdit, _CommitEditPayload>
export type DiscardEditPayload = $Call<typeof createDiscardEdit, _DiscardEditPayload>
export type DismissDownloadPayload = $Call<typeof createDismissDownload, _DismissDownloadPayload>
export type DownloadFinishedPayload = $Call<typeof createDownloadFinished, _DownloadFinishedPayload>
export type DownloadPayload = $Call<typeof createDownload, _DownloadPayload>
export type DownloadProgressPayload = $Call<typeof createDownloadProgress, _DownloadProgressPayload>
export type DownloadStartedPayload = $Call<typeof createDownloadStarted, _DownloadStartedPayload>
export type EditFailedPayload = $Call<typeof createEditFailed, _EditFailedPayload>
export type EditSuccessPayload = $Call<typeof createEditSuccess, _EditSuccessPayload>
export type FavoriteIgnoreErrorPayload = $Call<typeof createFavoriteIgnoreError, _FavoriteIgnoreErrorPayload>
export type FavoriteIgnorePayload = $Call<typeof createFavoriteIgnore, _FavoriteIgnorePayload>
export type FavoritesLoadPayload = $Call<typeof createFavoritesLoad, _FavoritesLoadPayload>
export type FavoritesLoadedPayload = $Call<typeof createFavoritesLoaded, _FavoritesLoadedPayload>
export type FileActionPopupPayload = $Call<typeof createFileActionPopup, _FileActionPopupPayload>
export type FilePreviewLoadPayload = $Call<typeof createFilePreviewLoad, _FilePreviewLoadPayload>
export type FilePreviewLoadedPayload = $Call<typeof createFilePreviewLoaded, _FilePreviewLoadedPayload>
export type FolderListLoadPayload = $Call<typeof createFolderListLoad, _FolderListLoadPayload>
export type FolderListLoadedPayload = $Call<typeof createFolderListLoaded, _FolderListLoadedPayload>
export type FsActivityPayload = $Call<typeof createFsActivity, _FsActivityPayload>
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
export type OpenFinderPopupPayload = $Call<typeof createOpenFinderPopup, _OpenFinderPopupPayload>
export type OpenInFileUIPayload = $Call<typeof createOpenInFileUI, _OpenInFileUIPayload>
export type OpenPathItemPayload = $Call<typeof createOpenPathItem, _OpenPathItemPayload>
export type OpenSecurityPreferencesPayload = $Call<typeof createOpenSecurityPreferences, _OpenSecurityPreferencesPayload>
export type PickAndUploadPayload = $Call<typeof createPickAndUpload, _PickAndUploadPayload>
export type RefreshLocalHTTPServerInfoPayload = $Call<typeof createRefreshLocalHTTPServerInfo, _RefreshLocalHTTPServerInfoPayload>
export type SaveMediaPayload = $Call<typeof createSaveMedia, _SaveMediaPayload>
export type SetFlagsPayload = $Call<typeof createSetFlags, _SetFlagsPayload>
export type SetupFSHandlersPayload = $Call<typeof createSetupFSHandlers, _SetupFSHandlersPayload>
export type ShareNativePayload = $Call<typeof createShareNative, _ShareNativePayload>
export type SortSettingPayload = $Call<typeof createSortSetting, _SortSettingPayload>
export type UninstallKBFSConfirmPayload = $Call<typeof createUninstallKBFSConfirm, _UninstallKBFSConfirmPayload>
export type UploadPayload = $Call<typeof createUpload, _UploadPayload>
export type UploadStartedPayload = $Call<typeof createUploadStarted, _UploadStartedPayload>
export type UploadWritingFinishedPayload = $Call<typeof createUploadWritingFinished, _UploadWritingFinishedPayload>

// All Actions
// prettier-ignore
export type Actions =
  | CancelDownloadPayload
  | CommitEditPayload
  | DiscardEditPayload
  | DismissDownloadPayload
  | DownloadFinishedPayload
  | DownloadPayload
  | DownloadProgressPayload
  | DownloadStartedPayload
  | EditFailedPayload
  | EditSuccessPayload
  | FavoriteIgnoreErrorPayload
  | FavoriteIgnorePayload
  | FavoritesLoadPayload
  | FavoritesLoadedPayload
  | FileActionPopupPayload
  | FilePreviewLoadPayload
  | FilePreviewLoadedPayload
  | FolderListLoadPayload
  | FolderListLoadedPayload
  | FsActivityPayload
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
  | OpenFinderPopupPayload
  | OpenInFileUIPayload
  | OpenPathItemPayload
  | OpenSecurityPreferencesPayload
  | PickAndUploadPayload
  | RefreshLocalHTTPServerInfoPayload
  | SaveMediaPayload
  | SetFlagsPayload
  | SetupFSHandlersPayload
  | ShareNativePayload
  | SortSettingPayload
  | UninstallKBFSConfirmPayload
  | UploadPayload
  | UploadStartedPayload
  | UploadWritingFinishedPayload
  | {type: 'common:resetStore', payload: void}
