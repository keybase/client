// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/fs'

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'fs:'
export const cancelDownload = 'fs:cancelDownload'
export const copy = 'fs:copy'
export const deleteFile = 'fs:deleteFile'
export const dismissDownload = 'fs:dismissDownload'
export const download = 'fs:download'
export const driverDisable = 'fs:driverDisable'
export const driverDisabling = 'fs:driverDisabling'
export const driverEnable = 'fs:driverEnable'
export const finishManualConflictResolution = 'fs:finishManualConflictResolution'
export const finishedDownloadWithIntent = 'fs:finishedDownloadWithIntent'
export const finishedRegularDownload = 'fs:finishedRegularDownload'
export const kbfsDaemonRpcStatusChanged = 'fs:kbfsDaemonRpcStatusChanged'
export const letResetUserBackIn = 'fs:letResetUserBackIn'
export const loadDownloadInfo = 'fs:loadDownloadInfo'
export const loadDownloadStatus = 'fs:loadDownloadStatus'
export const loadFilesTabBadge = 'fs:loadFilesTabBadge'
export const loadPathInfo = 'fs:loadPathInfo'
export const loadedFilesTabBadge = 'fs:loadedFilesTabBadge'
export const loadedPathInfo = 'fs:loadedPathInfo'
export const move = 'fs:move'
export const openAndUpload = 'fs:openAndUpload'
export const openFilesFromWidget = 'fs:openFilesFromWidget'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const pickAndUpload = 'fs:pickAndUpload'
export const placeholderAction = 'fs:placeholderAction'
export const refreshMountDirsAfter10s = 'fs:refreshMountDirsAfter10s'
export const setCriticalUpdate = 'fs:setCriticalUpdate'
export const setDebugLevel = 'fs:setDebugLevel'
export const setDriverStatus = 'fs:setDriverStatus'
export const setSfmiBannerDismissed = 'fs:setSfmiBannerDismissed'
export const setSpaceAvailableNotificationThreshold = 'fs:setSpaceAvailableNotificationThreshold'
export const startManualConflictResolution = 'fs:startManualConflictResolution'
export const userFileEditsLoad = 'fs:userFileEditsLoad'
export const userIn = 'fs:userIn'
export const userOut = 'fs:userOut'

// Action Creators
export const createCancelDownload = (payload: {readonly downloadID: string}) => ({
  payload,
  type: cancelDownload as typeof cancelDownload,
})
export const createCopy = (payload: {readonly destinationParentPath: Types.Path}) => ({
  payload,
  type: copy as typeof copy,
})
export const createDeleteFile = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: deleteFile as typeof deleteFile,
})
export const createDismissDownload = (payload: {readonly downloadID: string}) => ({
  payload,
  type: dismissDownload as typeof dismissDownload,
})
export const createDownload = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: download as typeof download,
})
export const createDriverDisable = (payload?: undefined) => ({
  payload,
  type: driverDisable as typeof driverDisable,
})
export const createDriverDisabling = (payload?: undefined) => ({
  payload,
  type: driverDisabling as typeof driverDisabling,
})
export const createDriverEnable = (payload: {readonly isRetry?: boolean} = {}) => ({
  payload,
  type: driverEnable as typeof driverEnable,
})
export const createFinishManualConflictResolution = (payload: {readonly localViewTlfPath: Types.Path}) => ({
  payload,
  type: finishManualConflictResolution as typeof finishManualConflictResolution,
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
export const createLetResetUserBackIn = (payload: {
  readonly id: RPCTypes.TeamID
  readonly username: string
}) => ({payload, type: letResetUserBackIn as typeof letResetUserBackIn})
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
export const createMove = (payload: {readonly destinationParentPath: Types.Path}) => ({
  payload,
  type: move as typeof move,
})
export const createOpenAndUpload = (payload: {
  readonly type: Types.OpenDialogType
  readonly parentPath: Types.Path
}) => ({payload, type: openAndUpload as typeof openAndUpload})
export const createOpenFilesFromWidget = (payload: {
  readonly path: Types.Path
  readonly type: Types.PathType
}) => ({payload, type: openFilesFromWidget as typeof openFilesFromWidget})
export const createOpenSecurityPreferences = (payload?: undefined) => ({
  payload,
  type: openSecurityPreferences as typeof openSecurityPreferences,
})
export const createPickAndUpload = (payload: {
  readonly type: Types.MobilePickType
  readonly parentPath: Types.Path
}) => ({payload, type: pickAndUpload as typeof pickAndUpload})
export const createPlaceholderAction = (payload?: undefined) => ({
  payload,
  type: placeholderAction as typeof placeholderAction,
})
export const createRefreshMountDirsAfter10s = (payload?: undefined) => ({
  payload,
  type: refreshMountDirsAfter10s as typeof refreshMountDirsAfter10s,
})
export const createSetCriticalUpdate = (payload: {readonly critical: boolean}) => ({
  payload,
  type: setCriticalUpdate as typeof setCriticalUpdate,
})
export const createSetDebugLevel = (payload: {readonly level: string}) => ({
  payload,
  type: setDebugLevel as typeof setDebugLevel,
})
export const createSetDriverStatus = (payload?: undefined) => ({
  payload,
  type: setDriverStatus as typeof setDriverStatus,
})
export const createSetSfmiBannerDismissed = (payload: {readonly dismissed: boolean}) => ({
  payload,
  type: setSfmiBannerDismissed as typeof setSfmiBannerDismissed,
})
export const createSetSpaceAvailableNotificationThreshold = (payload: {
  readonly spaceAvailableNotificationThreshold: number
}) => ({
  payload,
  type: setSpaceAvailableNotificationThreshold as typeof setSpaceAvailableNotificationThreshold,
})
export const createStartManualConflictResolution = (payload: {readonly tlfPath: Types.Path}) => ({
  payload,
  type: startManualConflictResolution as typeof startManualConflictResolution,
})
export const createUserFileEditsLoad = (payload?: undefined) => ({
  payload,
  type: userFileEditsLoad as typeof userFileEditsLoad,
})
export const createUserIn = (payload?: undefined) => ({payload, type: userIn as typeof userIn})
export const createUserOut = (payload?: undefined) => ({payload, type: userOut as typeof userOut})

// Action Payloads
export type CancelDownloadPayload = ReturnType<typeof createCancelDownload>
export type CopyPayload = ReturnType<typeof createCopy>
export type DeleteFilePayload = ReturnType<typeof createDeleteFile>
export type DismissDownloadPayload = ReturnType<typeof createDismissDownload>
export type DownloadPayload = ReturnType<typeof createDownload>
export type DriverDisablePayload = ReturnType<typeof createDriverDisable>
export type DriverDisablingPayload = ReturnType<typeof createDriverDisabling>
export type DriverEnablePayload = ReturnType<typeof createDriverEnable>
export type FinishManualConflictResolutionPayload = ReturnType<typeof createFinishManualConflictResolution>
export type FinishedDownloadWithIntentPayload = ReturnType<typeof createFinishedDownloadWithIntent>
export type FinishedRegularDownloadPayload = ReturnType<typeof createFinishedRegularDownload>
export type KbfsDaemonRpcStatusChangedPayload = ReturnType<typeof createKbfsDaemonRpcStatusChanged>
export type LetResetUserBackInPayload = ReturnType<typeof createLetResetUserBackIn>
export type LoadDownloadInfoPayload = ReturnType<typeof createLoadDownloadInfo>
export type LoadDownloadStatusPayload = ReturnType<typeof createLoadDownloadStatus>
export type LoadFilesTabBadgePayload = ReturnType<typeof createLoadFilesTabBadge>
export type LoadPathInfoPayload = ReturnType<typeof createLoadPathInfo>
export type LoadedFilesTabBadgePayload = ReturnType<typeof createLoadedFilesTabBadge>
export type LoadedPathInfoPayload = ReturnType<typeof createLoadedPathInfo>
export type MovePayload = ReturnType<typeof createMove>
export type OpenAndUploadPayload = ReturnType<typeof createOpenAndUpload>
export type OpenFilesFromWidgetPayload = ReturnType<typeof createOpenFilesFromWidget>
export type OpenSecurityPreferencesPayload = ReturnType<typeof createOpenSecurityPreferences>
export type PickAndUploadPayload = ReturnType<typeof createPickAndUpload>
export type PlaceholderActionPayload = ReturnType<typeof createPlaceholderAction>
export type RefreshMountDirsAfter10sPayload = ReturnType<typeof createRefreshMountDirsAfter10s>
export type SetCriticalUpdatePayload = ReturnType<typeof createSetCriticalUpdate>
export type SetDebugLevelPayload = ReturnType<typeof createSetDebugLevel>
export type SetDriverStatusPayload = ReturnType<typeof createSetDriverStatus>
export type SetSfmiBannerDismissedPayload = ReturnType<typeof createSetSfmiBannerDismissed>
export type SetSpaceAvailableNotificationThresholdPayload = ReturnType<
  typeof createSetSpaceAvailableNotificationThreshold
>
export type StartManualConflictResolutionPayload = ReturnType<typeof createStartManualConflictResolution>
export type UserFileEditsLoadPayload = ReturnType<typeof createUserFileEditsLoad>
export type UserInPayload = ReturnType<typeof createUserIn>
export type UserOutPayload = ReturnType<typeof createUserOut>

// All Actions
// prettier-ignore
export type Actions =
  | CancelDownloadPayload
  | CopyPayload
  | DeleteFilePayload
  | DismissDownloadPayload
  | DownloadPayload
  | DriverDisablePayload
  | DriverDisablingPayload
  | DriverEnablePayload
  | FinishManualConflictResolutionPayload
  | FinishedDownloadWithIntentPayload
  | FinishedRegularDownloadPayload
  | KbfsDaemonRpcStatusChangedPayload
  | LetResetUserBackInPayload
  | LoadDownloadInfoPayload
  | LoadDownloadStatusPayload
  | LoadFilesTabBadgePayload
  | LoadPathInfoPayload
  | LoadedFilesTabBadgePayload
  | LoadedPathInfoPayload
  | MovePayload
  | OpenAndUploadPayload
  | OpenFilesFromWidgetPayload
  | OpenSecurityPreferencesPayload
  | PickAndUploadPayload
  | PlaceholderActionPayload
  | RefreshMountDirsAfter10sPayload
  | SetCriticalUpdatePayload
  | SetDebugLevelPayload
  | SetDriverStatusPayload
  | SetSfmiBannerDismissedPayload
  | SetSpaceAvailableNotificationThresholdPayload
  | StartManualConflictResolutionPayload
  | UserFileEditsLoadPayload
  | UserInPayload
  | UserOutPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
