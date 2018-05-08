// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
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
export const localHTTPServerInfo = 'fs:localHTTPServerInfo'
export const onAction = 'fs:onAction'
export const openFinderPopup = 'fs:openFinderPopup'
export const openInFileUI = 'fs:openInFileUI'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const refreshLocalHTTPServerInfo = 'fs:refreshLocalHTTPServerInfo'
export const save = 'fs:save'
export const setFlags = 'fs:setFlags'
export const setupFSHandlers = 'fs:setupFSHandlers'
export const share = 'fs:share'
export const sortSetting = 'fs:sortSetting'
export const transferProgress = 'fs:transferProgress'
export const uninstallKBFS = 'fs:uninstallKBFS'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'

// Action Creators
export const createCancelTransfer = (payload: $ReadOnly<{|key: string|}>) => ({error: false, payload, type: cancelTransfer})
export const createDismissTransfer = (payload: $ReadOnly<{|key: string|}>) => ({error: false, payload, type: dismissTransfer})
export const createDownload = (
  payload: $ReadOnly<{|
    intent: Types.TransferIntent,
    path: Types.Path,
    localPath?: string,
  |}>
) => ({error: false, payload, type: download})
export const createDownloadFinished = (
  payload: $ReadOnly<{|
    key: string,
    error?: string,
  |}>
) => ({error: false, payload, type: downloadFinished})
export const createDownloadStarted = (
  payload: $ReadOnly<{|
    key: string,
    path: Types.Path,
    localPath: Types.LocalPath,
    intent: Types.TransferIntent,
    opID: RPCTypes.OpID,
  |}>
) => ({error: false, payload, type: downloadStarted})
export const createFavoriteIgnore = (payload: $ReadOnly<{|path: Types.Path|}>) => ({error: false, payload, type: favoriteIgnore})
export const createFavoriteIgnoreError = (
  payload: $ReadOnly<{|
    path: Types.Path,
    errorText: string,
  |}>
) => ({error: false, payload, type: favoriteIgnoreError})
export const createFavoritesLoad = () => ({error: false, payload: undefined, type: favoritesLoad})
export const createFavoritesLoaded = (payload: $ReadOnly<{|folders: I.Map<Types.Path, Types.FavoriteItem>|}>) => ({error: false, payload, type: favoritesLoaded})
export const createFilePreviewLoad = (payload: $ReadOnly<{|path: Types.Path|}>) => ({error: false, payload, type: filePreviewLoad})
export const createFilePreviewLoaded = (
  payload: $ReadOnly<{|
    path: Types.Path,
    meta: Types.PathItem,
  |}>
) => ({error: false, payload, type: filePreviewLoaded})
export const createFolderListLoad = (payload: $ReadOnly<{|path: Types.Path|}>) => ({error: false, payload, type: folderListLoad})
export const createFolderListLoaded = (
  payload: $ReadOnly<{|
    path: Types.Path,
    pathItems: I.Map<Types.Path, Types.PathItem>,
  |}>
) => ({error: false, payload, type: folderListLoaded})
export const createFsActivity = () => ({error: false, payload: undefined, type: fsActivity})
export const createFuseStatus = () => ({error: false, payload: undefined, type: fuseStatus})
export const createFuseStatusResult = (
  payload: $ReadOnly<{|
    prevStatus: ?RPCTypes.FuseStatus,
    status: RPCTypes.FuseStatus,
  |}>
) => ({error: false, payload, type: fuseStatusResult})
export const createInstallFuse = () => ({error: false, payload: undefined, type: installFuse})
export const createInstallFuseResult = (payload: $ReadOnly<{|kextPermissionError: boolean|}>) => ({error: false, payload, type: installFuseResult})
export const createInstallKBFS = () => ({error: false, payload: undefined, type: installKBFS})
export const createLocalHTTPServerInfo = (
  payload: $ReadOnly<{|
    address: string,
    token: string,
  |}>
) => ({error: false, payload, type: localHTTPServerInfo})
export const createOnAction = (
  payload: $ReadOnly<{|
    path: Types.Path,
    type: Types.PathType,
    targetRect: ?ClientRect,
  |}>
) => ({error: false, payload, type: onAction})
export const createOpenFinderPopup = (payload: $ReadOnly<{|targetRect: ?ClientRect|}>) => ({error: false, payload, type: openFinderPopup})
export const createOpenInFileUI = (payload: $ReadOnly<{|path?: string|}>) => ({error: false, payload, type: openInFileUI})
export const createOpenSecurityPreferences = () => ({error: false, payload: undefined, type: openSecurityPreferences})
export const createRefreshLocalHTTPServerInfo = () => ({error: false, payload: undefined, type: refreshLocalHTTPServerInfo})
export const createSave = (payload: $ReadOnly<{|path: Types.Path|}>) => ({error: false, payload, type: save})
export const createSetFlags = (
  payload: $ReadOnly<{|
    kbfsOpening?: boolean,
    kbfsInstalling?: boolean,
    fuseInstalling?: boolean,
    kextPermissionError?: boolean,
    securityPrefsPropmted?: boolean,
    showBanner?: boolean,
    syncing?: boolean,
  |}>
) => ({error: false, payload, type: setFlags})
export const createSetupFSHandlers = () => ({error: false, payload: undefined, type: setupFSHandlers})
export const createShare = (payload: $ReadOnly<{|path: Types.Path|}>) => ({error: false, payload, type: share})
export const createSortSetting = (
  payload: $ReadOnly<{|
    path: Types.Path,
    sortSetting: Types.SortSetting,
  |}>
) => ({error: false, payload, type: sortSetting})
export const createTransferProgress = (
  payload: $ReadOnly<{|
    key: string,
    completePortion: number,
    endEstimate?: number,
  |}>
) => ({error: false, payload, type: transferProgress})
export const createUninstallKBFS = () => ({error: false, payload: undefined, type: uninstallKBFS})
export const createUninstallKBFSConfirm = (payload: $ReadOnly<{|onSuccess: () => void|}>) => ({error: false, payload, type: uninstallKBFSConfirm})

// Action Payloads
export type CancelTransferPayload = More.ReturnType<typeof createCancelTransfer>
export type DismissTransferPayload = More.ReturnType<typeof createDismissTransfer>
export type DownloadFinishedPayload = More.ReturnType<typeof createDownloadFinished>
export type DownloadPayload = More.ReturnType<typeof createDownload>
export type DownloadStartedPayload = More.ReturnType<typeof createDownloadStarted>
export type FavoriteIgnoreErrorPayload = More.ReturnType<typeof createFavoriteIgnoreError>
export type FavoriteIgnorePayload = More.ReturnType<typeof createFavoriteIgnore>
export type FavoritesLoadPayload = More.ReturnType<typeof createFavoritesLoad>
export type FavoritesLoadedPayload = More.ReturnType<typeof createFavoritesLoaded>
export type FilePreviewLoadPayload = More.ReturnType<typeof createFilePreviewLoad>
export type FilePreviewLoadedPayload = More.ReturnType<typeof createFilePreviewLoaded>
export type FolderListLoadPayload = More.ReturnType<typeof createFolderListLoad>
export type FolderListLoadedPayload = More.ReturnType<typeof createFolderListLoaded>
export type FsActivityPayload = More.ReturnType<typeof createFsActivity>
export type FuseStatusPayload = More.ReturnType<typeof createFuseStatus>
export type FuseStatusResultPayload = More.ReturnType<typeof createFuseStatusResult>
export type InstallFusePayload = More.ReturnType<typeof createInstallFuse>
export type InstallFuseResultPayload = More.ReturnType<typeof createInstallFuseResult>
export type InstallKBFSPayload = More.ReturnType<typeof createInstallKBFS>
export type LocalHTTPServerInfoPayload = More.ReturnType<typeof createLocalHTTPServerInfo>
export type OnActionPayload = More.ReturnType<typeof createOnAction>
export type OpenFinderPopupPayload = More.ReturnType<typeof createOpenFinderPopup>
export type OpenInFileUIPayload = More.ReturnType<typeof createOpenInFileUI>
export type OpenSecurityPreferencesPayload = More.ReturnType<typeof createOpenSecurityPreferences>
export type RefreshLocalHTTPServerInfoPayload = More.ReturnType<typeof createRefreshLocalHTTPServerInfo>
export type SavePayload = More.ReturnType<typeof createSave>
export type SetFlagsPayload = More.ReturnType<typeof createSetFlags>
export type SetupFSHandlersPayload = More.ReturnType<typeof createSetupFSHandlers>
export type SharePayload = More.ReturnType<typeof createShare>
export type SortSettingPayload = More.ReturnType<typeof createSortSetting>
export type TransferProgressPayload = More.ReturnType<typeof createTransferProgress>
export type UninstallKBFSConfirmPayload = More.ReturnType<typeof createUninstallKBFSConfirm>
export type UninstallKBFSPayload = More.ReturnType<typeof createUninstallKBFS>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createCancelTransfer>
  | More.ReturnType<typeof createDismissTransfer>
  | More.ReturnType<typeof createDownload>
  | More.ReturnType<typeof createDownloadFinished>
  | More.ReturnType<typeof createDownloadStarted>
  | More.ReturnType<typeof createFavoriteIgnore>
  | More.ReturnType<typeof createFavoriteIgnoreError>
  | More.ReturnType<typeof createFavoritesLoad>
  | More.ReturnType<typeof createFavoritesLoaded>
  | More.ReturnType<typeof createFilePreviewLoad>
  | More.ReturnType<typeof createFilePreviewLoaded>
  | More.ReturnType<typeof createFolderListLoad>
  | More.ReturnType<typeof createFolderListLoaded>
  | More.ReturnType<typeof createFsActivity>
  | More.ReturnType<typeof createFuseStatus>
  | More.ReturnType<typeof createFuseStatusResult>
  | More.ReturnType<typeof createInstallFuse>
  | More.ReturnType<typeof createInstallFuseResult>
  | More.ReturnType<typeof createInstallKBFS>
  | More.ReturnType<typeof createLocalHTTPServerInfo>
  | More.ReturnType<typeof createOnAction>
  | More.ReturnType<typeof createOpenFinderPopup>
  | More.ReturnType<typeof createOpenInFileUI>
  | More.ReturnType<typeof createOpenSecurityPreferences>
  | More.ReturnType<typeof createRefreshLocalHTTPServerInfo>
  | More.ReturnType<typeof createSave>
  | More.ReturnType<typeof createSetFlags>
  | More.ReturnType<typeof createSetupFSHandlers>
  | More.ReturnType<typeof createShare>
  | More.ReturnType<typeof createSortSetting>
  | More.ReturnType<typeof createTransferProgress>
  | More.ReturnType<typeof createUninstallKBFS>
  | More.ReturnType<typeof createUninstallKBFSConfirm>
  | {type: 'common:resetStore', payload: void}
