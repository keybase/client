// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/fs'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'fs:'
export const cancelDownload = 'fs:cancelDownload'
export const dismissDownload = 'fs:dismissDownload'
export const download = 'fs:download'
export const finishedDownloadWithIntent = 'fs:finishedDownloadWithIntent'
export const finishedRegularDownload = 'fs:finishedRegularDownload'
export const kbfsDaemonRpcStatusChanged = 'fs:kbfsDaemonRpcStatusChanged'
export const loadDownloadInfo = 'fs:loadDownloadInfo'
export const loadDownloadStatus = 'fs:loadDownloadStatus'
export const loadFilesTabBadge = 'fs:loadFilesTabBadge'
export const loadPathInfo = 'fs:loadPathInfo'
export const loadedFilesTabBadge = 'fs:loadedFilesTabBadge'
export const loadedPathInfo = 'fs:loadedPathInfo'
export const placeholderAction = 'fs:placeholderAction'
export const setCriticalUpdate = 'fs:setCriticalUpdate'
export const setDebugLevel = 'fs:setDebugLevel'
export const setSpaceAvailableNotificationThreshold = 'fs:setSpaceAvailableNotificationThreshold'
export const userIn = 'fs:userIn'
export const userOut = 'fs:userOut'

// Action Creators
export const createCancelDownload = (payload: {readonly downloadID: string}) => ({
  payload,
  type: cancelDownload as typeof cancelDownload,
})
export const createDismissDownload = (payload: {readonly downloadID: string}) => ({
  payload,
  type: dismissDownload as typeof dismissDownload,
})
export const createDownload = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: download as typeof download,
})
export const createFinishedDownloadWithIntent = (payload: {
  readonly downloadID: string
  readonly downloadIntent: Types.DownloadIntent
  readonly mimeType: string
}) => ({payload, type: finishedDownloadWithIntent as typeof finishedDownloadWithIntent})
export const createFinishedRegularDownload = (payload: {
  readonly downloadID: string
  readonly mimeType: string
}) => ({payload, type: finishedRegularDownload as typeof finishedRegularDownload})
export const createKbfsDaemonRpcStatusChanged = (payload?: undefined) => ({
  payload,
  type: kbfsDaemonRpcStatusChanged as typeof kbfsDaemonRpcStatusChanged,
})
export const createLoadDownloadInfo = (payload: {readonly downloadID: string}) => ({
  payload,
  type: loadDownloadInfo as typeof loadDownloadInfo,
})
export const createLoadDownloadStatus = (payload?: undefined) => ({
  payload,
  type: loadDownloadStatus as typeof loadDownloadStatus,
})
export const createLoadFilesTabBadge = (payload?: undefined) => ({
  payload,
  type: loadFilesTabBadge as typeof loadFilesTabBadge,
})
export const createLoadPathInfo = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: loadPathInfo as typeof loadPathInfo,
})
export const createLoadedFilesTabBadge = (payload: {readonly badge: RPCTypes.FilesTabBadge}) => ({
  payload,
  type: loadedFilesTabBadge as typeof loadedFilesTabBadge,
})
export const createLoadedPathInfo = (payload: {
  readonly path: Types.Path
  readonly pathInfo: Types.PathInfo
}) => ({payload, type: loadedPathInfo as typeof loadedPathInfo})
export const createPlaceholderAction = (payload?: undefined) => ({
  payload,
  type: placeholderAction as typeof placeholderAction,
})
export const createSetCriticalUpdate = (payload: {readonly critical: boolean}) => ({
  payload,
  type: setCriticalUpdate as typeof setCriticalUpdate,
})
export const createSetDebugLevel = (payload: {readonly level: string}) => ({
  payload,
  type: setDebugLevel as typeof setDebugLevel,
})
export const createSetSpaceAvailableNotificationThreshold = (payload: {
  readonly spaceAvailableNotificationThreshold: number
}) => ({
  payload,
  type: setSpaceAvailableNotificationThreshold as typeof setSpaceAvailableNotificationThreshold,
})
export const createUserIn = (payload?: undefined) => ({payload, type: userIn as typeof userIn})
export const createUserOut = (payload?: undefined) => ({payload, type: userOut as typeof userOut})

// Action Payloads
export type CancelDownloadPayload = ReturnType<typeof createCancelDownload>
export type DismissDownloadPayload = ReturnType<typeof createDismissDownload>
export type DownloadPayload = ReturnType<typeof createDownload>
export type FinishedDownloadWithIntentPayload = ReturnType<typeof createFinishedDownloadWithIntent>
export type FinishedRegularDownloadPayload = ReturnType<typeof createFinishedRegularDownload>
export type KbfsDaemonRpcStatusChangedPayload = ReturnType<typeof createKbfsDaemonRpcStatusChanged>
export type LoadDownloadInfoPayload = ReturnType<typeof createLoadDownloadInfo>
export type LoadDownloadStatusPayload = ReturnType<typeof createLoadDownloadStatus>
export type LoadFilesTabBadgePayload = ReturnType<typeof createLoadFilesTabBadge>
export type LoadPathInfoPayload = ReturnType<typeof createLoadPathInfo>
export type LoadedFilesTabBadgePayload = ReturnType<typeof createLoadedFilesTabBadge>
export type LoadedPathInfoPayload = ReturnType<typeof createLoadedPathInfo>
export type PlaceholderActionPayload = ReturnType<typeof createPlaceholderAction>
export type SetCriticalUpdatePayload = ReturnType<typeof createSetCriticalUpdate>
export type SetDebugLevelPayload = ReturnType<typeof createSetDebugLevel>
export type SetSpaceAvailableNotificationThresholdPayload = ReturnType<
  typeof createSetSpaceAvailableNotificationThreshold
>
export type UserInPayload = ReturnType<typeof createUserIn>
export type UserOutPayload = ReturnType<typeof createUserOut>

// All Actions
// prettier-ignore
export type Actions =
  | CancelDownloadPayload
  | DismissDownloadPayload
  | DownloadPayload
  | FinishedDownloadWithIntentPayload
  | FinishedRegularDownloadPayload
  | KbfsDaemonRpcStatusChangedPayload
  | LoadDownloadInfoPayload
  | LoadDownloadStatusPayload
  | LoadFilesTabBadgePayload
  | LoadPathInfoPayload
  | LoadedFilesTabBadgePayload
  | LoadedPathInfoPayload
  | PlaceholderActionPayload
  | SetCriticalUpdatePayload
  | SetDebugLevelPayload
  | SetSpaceAvailableNotificationThresholdPayload
  | UserInPayload
  | UserOutPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
