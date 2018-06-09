// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/fs'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer
export const cancelTransfer = 'fs:cancelTransfer'
export const dismissTransfer = 'fs:dismissTransfer'
export const download = 'fs:download'
export const downloadFinished = 'fs:downloadFinished'
export const downloadStarted = 'fs:downloadStarted'
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
export const loadResets = 'fs:loadResets'
export const loadResetsResult = 'fs:loadResetsResult'
export const localHTTPServerInfo = 'fs:localHTTPServerInfo'
export const mimeTypeLoad = 'fs:mimeTypeLoad'
export const mimeTypeLoaded = 'fs:mimeTypeLoaded'
export const openFinderPopup = 'fs:openFinderPopup'
export const openInFileUI = 'fs:openInFileUI'
export const openPathItem = 'fs:openPathItem'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const refreshLocalHTTPServerInfo = 'fs:refreshLocalHTTPServerInfo'
export const save = 'fs:save'
export const setFlags = 'fs:setFlags'
export const setupFSHandlers = 'fs:setupFSHandlers'
export const share = 'fs:share'
export const sortSetting = 'fs:sortSetting'
export const transferProgress = 'fs:transferProgress'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'

// Payload Types
type _CancelTransferPayload = $ReadOnly<{|key: string|}>
type _DismissTransferPayload = $ReadOnly<{|key: string|}>
type _DownloadFinishedPayload = $ReadOnly<{|
  key: string,
  error?: string,
|}>
type _DownloadPayload = $ReadOnly<{|
  intent: Types.TransferIntent,
  path: Types.Path,
  localPath?: string,
|}>
type _DownloadStartedPayload = $ReadOnly<{|
  key: string,
  path: Types.Path,
  localPath: Types.LocalPath,
  intent: Types.TransferIntent,
  opID: RPCTypes.OpID,
|}>
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
type _LoadResetsPayload = void
type _LoadResetsResultPayload = $ReadOnly<{|tlfs: I.Map<Types.Path, Types.ResetMetadata>|}>
type _LocalHTTPServerInfoPayload = $ReadOnly<{|
  address: string,
  token: string,
|}>
type _MimeTypeLoadPayload = $ReadOnly<{|path: Types.Path|}>
type _MimeTypeLoadedPayload = $ReadOnly<{|
  path: Types.Path,
  mimeType: string,
|}>
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
type _RefreshLocalHTTPServerInfoPayload = void
type _SavePayload = $ReadOnly<{|
  path: Types.Path,
  routePath: I.List<string>,
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
type _SharePayload = $ReadOnly<{|
  path: Types.Path,
  routePath: I.List<string>,
|}>
type _SortSettingPayload = $ReadOnly<{|
  path: Types.Path,
  sortSetting: Types.SortSetting,
|}>
type _TransferProgressPayload = $ReadOnly<{|
  key: string,
  completePortion: number,
  endEstimate?: number,
|}>
type _UninstallKBFSConfirmPayload = void

// Action Creators
export const createCancelTransfer = (payload: _CancelTransferPayload) => ({error: false, payload, type: cancelTransfer})
export const createDismissTransfer = (payload: _DismissTransferPayload) => ({error: false, payload, type: dismissTransfer})
export const createDownload = (payload: _DownloadPayload) => ({error: false, payload, type: download})
export const createDownloadFinished = (payload: _DownloadFinishedPayload) => ({error: false, payload, type: downloadFinished})
export const createDownloadStarted = (payload: _DownloadStartedPayload) => ({error: false, payload, type: downloadStarted})
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
export const createLoadResets = (payload: _LoadResetsPayload) => ({error: false, payload, type: loadResets})
export const createLoadResetsResult = (payload: _LoadResetsResultPayload) => ({error: false, payload, type: loadResetsResult})
export const createLocalHTTPServerInfo = (payload: _LocalHTTPServerInfoPayload) => ({error: false, payload, type: localHTTPServerInfo})
export const createMimeTypeLoad = (payload: _MimeTypeLoadPayload) => ({error: false, payload, type: mimeTypeLoad})
export const createMimeTypeLoaded = (payload: _MimeTypeLoadedPayload) => ({error: false, payload, type: mimeTypeLoaded})
export const createOpenFinderPopup = (payload: _OpenFinderPopupPayload) => ({error: false, payload, type: openFinderPopup})
export const createOpenInFileUI = (payload: _OpenInFileUIPayload) => ({error: false, payload, type: openInFileUI})
export const createOpenPathItem = (payload: _OpenPathItemPayload) => ({error: false, payload, type: openPathItem})
export const createOpenSecurityPreferences = (payload: _OpenSecurityPreferencesPayload) => ({error: false, payload, type: openSecurityPreferences})
export const createRefreshLocalHTTPServerInfo = (payload: _RefreshLocalHTTPServerInfoPayload) => ({error: false, payload, type: refreshLocalHTTPServerInfo})
export const createSave = (payload: _SavePayload) => ({error: false, payload, type: save})
export const createSetFlags = (payload: _SetFlagsPayload) => ({error: false, payload, type: setFlags})
export const createSetupFSHandlers = (payload: _SetupFSHandlersPayload) => ({error: false, payload, type: setupFSHandlers})
export const createShare = (payload: _SharePayload) => ({error: false, payload, type: share})
export const createSortSetting = (payload: _SortSettingPayload) => ({error: false, payload, type: sortSetting})
export const createTransferProgress = (payload: _TransferProgressPayload) => ({error: false, payload, type: transferProgress})
export const createUninstallKBFSConfirm = (payload: _UninstallKBFSConfirmPayload) => ({error: false, payload, type: uninstallKBFSConfirm})

// Action Payloads
export type CancelTransferPayload = $Call<typeof createCancelTransfer, _CancelTransferPayload>
export type DismissTransferPayload = $Call<typeof createDismissTransfer, _DismissTransferPayload>
export type DownloadFinishedPayload = $Call<typeof createDownloadFinished, _DownloadFinishedPayload>
export type DownloadPayload = $Call<typeof createDownload, _DownloadPayload>
export type DownloadStartedPayload = $Call<typeof createDownloadStarted, _DownloadStartedPayload>
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
export type LoadResetsPayload = $Call<typeof createLoadResets, _LoadResetsPayload>
export type LoadResetsResultPayload = $Call<typeof createLoadResetsResult, _LoadResetsResultPayload>
export type LocalHTTPServerInfoPayload = $Call<typeof createLocalHTTPServerInfo, _LocalHTTPServerInfoPayload>
export type MimeTypeLoadPayload = $Call<typeof createMimeTypeLoad, _MimeTypeLoadPayload>
export type MimeTypeLoadedPayload = $Call<typeof createMimeTypeLoaded, _MimeTypeLoadedPayload>
export type OpenFinderPopupPayload = $Call<typeof createOpenFinderPopup, _OpenFinderPopupPayload>
export type OpenInFileUIPayload = $Call<typeof createOpenInFileUI, _OpenInFileUIPayload>
export type OpenPathItemPayload = $Call<typeof createOpenPathItem, _OpenPathItemPayload>
export type OpenSecurityPreferencesPayload = $Call<typeof createOpenSecurityPreferences, _OpenSecurityPreferencesPayload>
export type RefreshLocalHTTPServerInfoPayload = $Call<typeof createRefreshLocalHTTPServerInfo, _RefreshLocalHTTPServerInfoPayload>
export type SavePayload = $Call<typeof createSave, _SavePayload>
export type SetFlagsPayload = $Call<typeof createSetFlags, _SetFlagsPayload>
export type SetupFSHandlersPayload = $Call<typeof createSetupFSHandlers, _SetupFSHandlersPayload>
export type SharePayload = $Call<typeof createShare, _SharePayload>
export type SortSettingPayload = $Call<typeof createSortSetting, _SortSettingPayload>
export type TransferProgressPayload = $Call<typeof createTransferProgress, _TransferProgressPayload>
export type UninstallKBFSConfirmPayload = $Call<typeof createUninstallKBFSConfirm, _UninstallKBFSConfirmPayload>

// All Actions
// prettier-ignore
export type Actions =
  | CancelTransferPayload
  | DismissTransferPayload
  | DownloadFinishedPayload
  | DownloadPayload
  | DownloadStartedPayload
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
  | LoadResetsPayload
  | LoadResetsResultPayload
  | LocalHTTPServerInfoPayload
  | MimeTypeLoadPayload
  | MimeTypeLoadedPayload
  | OpenFinderPopupPayload
  | OpenInFileUIPayload
  | OpenPathItemPayload
  | OpenSecurityPreferencesPayload
  | RefreshLocalHTTPServerInfoPayload
  | SavePayload
  | SetFlagsPayload
  | SetupFSHandlersPayload
  | SharePayload
  | SortSettingPayload
  | TransferProgressPayload
  | UninstallKBFSConfirmPayload
  | {type: 'common:resetStore', payload: void}
