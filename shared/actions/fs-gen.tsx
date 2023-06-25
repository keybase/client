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
export const dismissUpload = 'fs:dismissUpload'
export const download = 'fs:download'
export const driverDisable = 'fs:driverDisable'
export const driverDisabling = 'fs:driverDisabling'
export const driverEnable = 'fs:driverEnable'
export const favoriteIgnore = 'fs:favoriteIgnore'
export const favoriteIgnoreError = 'fs:favoriteIgnoreError'
export const favoritesLoad = 'fs:favoritesLoad'
export const favoritesLoaded = 'fs:favoritesLoaded'
export const finishManualConflictResolution = 'fs:finishManualConflictResolution'
export const finishedDownloadWithIntent = 'fs:finishedDownloadWithIntent'
export const finishedRegularDownload = 'fs:finishedRegularDownload'
export const getOnlineStatus = 'fs:getOnlineStatus'
export const journalUpdate = 'fs:journalUpdate'
export const kbfsDaemonRpcStatusChanged = 'fs:kbfsDaemonRpcStatusChanged'
export const letResetUserBackIn = 'fs:letResetUserBackIn'
export const loadAdditionalTlf = 'fs:loadAdditionalTlf'
export const loadDownloadInfo = 'fs:loadDownloadInfo'
export const loadDownloadStatus = 'fs:loadDownloadStatus'
export const loadFilesTabBadge = 'fs:loadFilesTabBadge'
export const loadPathInfo = 'fs:loadPathInfo'
export const loadTlfSyncConfig = 'fs:loadTlfSyncConfig'
export const loadUploadStatus = 'fs:loadUploadStatus'
export const loadedAdditionalTlf = 'fs:loadedAdditionalTlf'
export const loadedFilesTabBadge = 'fs:loadedFilesTabBadge'
export const loadedPathInfo = 'fs:loadedPathInfo'
export const loadedUploadStatus = 'fs:loadedUploadStatus'
export const move = 'fs:move'
export const openAndUpload = 'fs:openAndUpload'
export const openFilesFromWidget = 'fs:openFilesFromWidget'
export const openLocalPathInSystemFileManager = 'fs:openLocalPathInSystemFileManager'
export const openPathInSystemFileManager = 'fs:openPathInSystemFileManager'
export const openSecurityPreferences = 'fs:openSecurityPreferences'
export const pickAndUpload = 'fs:pickAndUpload'
export const placeholderAction = 'fs:placeholderAction'
export const pollJournalStatus = 'fs:pollJournalStatus'
export const refreshDriverStatus = 'fs:refreshDriverStatus'
export const refreshMountDirsAfter10s = 'fs:refreshMountDirsAfter10s'
export const saveMedia = 'fs:saveMedia'
export const setCriticalUpdate = 'fs:setCriticalUpdate'
export const setDebugLevel = 'fs:setDebugLevel'
export const setDriverStatus = 'fs:setDriverStatus'
export const setPathSoftError = 'fs:setPathSoftError'
export const setSfmiBannerDismissed = 'fs:setSfmiBannerDismissed'
export const setSpaceAvailableNotificationThreshold = 'fs:setSpaceAvailableNotificationThreshold'
export const setTlfSoftError = 'fs:setTlfSoftError'
export const setTlfSyncConfig = 'fs:setTlfSyncConfig'
export const setTlfsAsUnloaded = 'fs:setTlfsAsUnloaded'
export const shareNative = 'fs:shareNative'
export const startManualConflictResolution = 'fs:startManualConflictResolution'
export const subscribeNonPath = 'fs:subscribeNonPath'
export const subscribePath = 'fs:subscribePath'
export const tlfSyncConfigLoaded = 'fs:tlfSyncConfigLoaded'
export const uninstallKBFSConfirm = 'fs:uninstallKBFSConfirm'
export const unsubscribe = 'fs:unsubscribe'
export const upload = 'fs:upload'
export const uploadFromDragAndDrop = 'fs:uploadFromDragAndDrop'
export const userFileEditsLoad = 'fs:userFileEditsLoad'
export const userFileEditsLoaded = 'fs:userFileEditsLoaded'
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
export const createDismissUpload = (payload: {readonly uploadID: string}) => ({
  payload,
  type: dismissUpload as typeof dismissUpload,
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
export const createFavoriteIgnore = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: favoriteIgnore as typeof favoriteIgnore,
})
export const createFavoriteIgnoreError = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: favoriteIgnoreError as typeof favoriteIgnoreError,
})
export const createFavoritesLoad = (payload?: undefined) => ({
  payload,
  type: favoritesLoad as typeof favoritesLoad,
})
export const createFavoritesLoaded = (payload: {
  readonly private: Types.TlfList
  readonly public: Types.TlfList
  readonly team: Types.TlfList
}) => ({payload, type: favoritesLoaded as typeof favoritesLoaded})
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
export const createGetOnlineStatus = (payload?: undefined) => ({
  payload,
  type: getOnlineStatus as typeof getOnlineStatus,
})
export const createJournalUpdate = (payload: {
  readonly syncingPaths: Array<Types.Path>
  readonly totalSyncingBytes: number
  readonly endEstimate?: number
}) => ({payload, type: journalUpdate as typeof journalUpdate})
export const createKbfsDaemonRpcStatusChanged = (payload?: undefined) => ({
  payload,
  type: kbfsDaemonRpcStatusChanged as typeof kbfsDaemonRpcStatusChanged,
})
export const createLetResetUserBackIn = (payload: {
  readonly id: RPCTypes.TeamID
  readonly username: string
}) => ({payload, type: letResetUserBackIn as typeof letResetUserBackIn})
export const createLoadAdditionalTlf = (payload: {readonly tlfPath: Types.Path}) => ({
  payload,
  type: loadAdditionalTlf as typeof loadAdditionalTlf,
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
export const createLoadTlfSyncConfig = (payload: {readonly tlfPath: Types.Path}) => ({
  payload,
  type: loadTlfSyncConfig as typeof loadTlfSyncConfig,
})
export const createLoadUploadStatus = (payload?: undefined) => ({
  payload,
  type: loadUploadStatus as typeof loadUploadStatus,
})
export const createLoadedAdditionalTlf = (payload: {
  readonly tlf: Types.Tlf
  readonly tlfPath: Types.Path
}) => ({payload, type: loadedAdditionalTlf as typeof loadedAdditionalTlf})
export const createLoadedFilesTabBadge = (payload: {readonly badge: RPCTypes.FilesTabBadge}) => ({
  payload,
  type: loadedFilesTabBadge as typeof loadedFilesTabBadge,
})
export const createLoadedPathInfo = (payload: {
  readonly path: Types.Path
  readonly pathInfo: Types.PathInfo
}) => ({payload, type: loadedPathInfo as typeof loadedPathInfo})
export const createLoadedUploadStatus = (payload: {readonly uploadStates: Array<RPCTypes.UploadState>}) => ({
  payload,
  type: loadedUploadStatus as typeof loadedUploadStatus,
})
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
export const createOpenLocalPathInSystemFileManager = (payload: {readonly localPath: string}) => ({
  payload,
  type: openLocalPathInSystemFileManager as typeof openLocalPathInSystemFileManager,
})
export const createOpenPathInSystemFileManager = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: openPathInSystemFileManager as typeof openPathInSystemFileManager,
})
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
export const createPollJournalStatus = (payload?: undefined) => ({
  payload,
  type: pollJournalStatus as typeof pollJournalStatus,
})
export const createRefreshDriverStatus = (payload?: undefined) => ({
  payload,
  type: refreshDriverStatus as typeof refreshDriverStatus,
})
export const createRefreshMountDirsAfter10s = (payload?: undefined) => ({
  payload,
  type: refreshMountDirsAfter10s as typeof refreshMountDirsAfter10s,
})
export const createSaveMedia = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: saveMedia as typeof saveMedia,
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
export const createSetPathSoftError = (payload: {
  readonly path: Types.Path
  readonly softError?: Types.SoftError
}) => ({payload, type: setPathSoftError as typeof setPathSoftError})
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
export const createSetTlfSoftError = (payload: {
  readonly path: Types.Path
  readonly softError?: Types.SoftError
}) => ({payload, type: setTlfSoftError as typeof setTlfSoftError})
export const createSetTlfSyncConfig = (payload: {
  readonly enabled: boolean
  readonly tlfPath: Types.Path
}) => ({payload, type: setTlfSyncConfig as typeof setTlfSyncConfig})
export const createSetTlfsAsUnloaded = (payload?: undefined) => ({
  payload,
  type: setTlfsAsUnloaded as typeof setTlfsAsUnloaded,
})
export const createShareNative = (payload: {readonly path: Types.Path}) => ({
  payload,
  type: shareNative as typeof shareNative,
})
export const createStartManualConflictResolution = (payload: {readonly tlfPath: Types.Path}) => ({
  payload,
  type: startManualConflictResolution as typeof startManualConflictResolution,
})
export const createSubscribeNonPath = (payload: {
  readonly subscriptionID: string
  readonly topic: RPCTypes.SubscriptionTopic
}) => ({payload, type: subscribeNonPath as typeof subscribeNonPath})
export const createSubscribePath = (payload: {
  readonly subscriptionID: string
  readonly path: Types.Path
  readonly topic: RPCTypes.PathSubscriptionTopic
}) => ({payload, type: subscribePath as typeof subscribePath})
export const createTlfSyncConfigLoaded = (payload: {
  readonly tlfType: Types.TlfType
  readonly tlfName: string
  readonly syncConfig: Types.TlfSyncConfig
}) => ({payload, type: tlfSyncConfigLoaded as typeof tlfSyncConfigLoaded})
export const createUninstallKBFSConfirm = (payload?: undefined) => ({
  payload,
  type: uninstallKBFSConfirm as typeof uninstallKBFSConfirm,
})
export const createUnsubscribe = (payload: {readonly subscriptionID: string}) => ({
  payload,
  type: unsubscribe as typeof unsubscribe,
})
export const createUpload = (payload: {readonly parentPath: Types.Path; readonly localPath: string}) => ({
  payload,
  type: upload as typeof upload,
})
export const createUploadFromDragAndDrop = (payload: {
  readonly parentPath: Types.Path
  readonly localPaths: Array<string>
}) => ({payload, type: uploadFromDragAndDrop as typeof uploadFromDragAndDrop})
export const createUserFileEditsLoad = (payload?: undefined) => ({
  payload,
  type: userFileEditsLoad as typeof userFileEditsLoad,
})
export const createUserFileEditsLoaded = (payload: {readonly tlfUpdates: Types.UserTlfUpdates}) => ({
  payload,
  type: userFileEditsLoaded as typeof userFileEditsLoaded,
})
export const createUserIn = (payload?: undefined) => ({payload, type: userIn as typeof userIn})
export const createUserOut = (payload?: undefined) => ({payload, type: userOut as typeof userOut})

// Action Payloads
export type CancelDownloadPayload = ReturnType<typeof createCancelDownload>
export type CopyPayload = ReturnType<typeof createCopy>
export type DeleteFilePayload = ReturnType<typeof createDeleteFile>
export type DismissDownloadPayload = ReturnType<typeof createDismissDownload>
export type DismissUploadPayload = ReturnType<typeof createDismissUpload>
export type DownloadPayload = ReturnType<typeof createDownload>
export type DriverDisablePayload = ReturnType<typeof createDriverDisable>
export type DriverDisablingPayload = ReturnType<typeof createDriverDisabling>
export type DriverEnablePayload = ReturnType<typeof createDriverEnable>
export type FavoriteIgnoreErrorPayload = ReturnType<typeof createFavoriteIgnoreError>
export type FavoriteIgnorePayload = ReturnType<typeof createFavoriteIgnore>
export type FavoritesLoadPayload = ReturnType<typeof createFavoritesLoad>
export type FavoritesLoadedPayload = ReturnType<typeof createFavoritesLoaded>
export type FinishManualConflictResolutionPayload = ReturnType<typeof createFinishManualConflictResolution>
export type FinishedDownloadWithIntentPayload = ReturnType<typeof createFinishedDownloadWithIntent>
export type FinishedRegularDownloadPayload = ReturnType<typeof createFinishedRegularDownload>
export type GetOnlineStatusPayload = ReturnType<typeof createGetOnlineStatus>
export type JournalUpdatePayload = ReturnType<typeof createJournalUpdate>
export type KbfsDaemonRpcStatusChangedPayload = ReturnType<typeof createKbfsDaemonRpcStatusChanged>
export type LetResetUserBackInPayload = ReturnType<typeof createLetResetUserBackIn>
export type LoadAdditionalTlfPayload = ReturnType<typeof createLoadAdditionalTlf>
export type LoadDownloadInfoPayload = ReturnType<typeof createLoadDownloadInfo>
export type LoadDownloadStatusPayload = ReturnType<typeof createLoadDownloadStatus>
export type LoadFilesTabBadgePayload = ReturnType<typeof createLoadFilesTabBadge>
export type LoadPathInfoPayload = ReturnType<typeof createLoadPathInfo>
export type LoadTlfSyncConfigPayload = ReturnType<typeof createLoadTlfSyncConfig>
export type LoadUploadStatusPayload = ReturnType<typeof createLoadUploadStatus>
export type LoadedAdditionalTlfPayload = ReturnType<typeof createLoadedAdditionalTlf>
export type LoadedFilesTabBadgePayload = ReturnType<typeof createLoadedFilesTabBadge>
export type LoadedPathInfoPayload = ReturnType<typeof createLoadedPathInfo>
export type LoadedUploadStatusPayload = ReturnType<typeof createLoadedUploadStatus>
export type MovePayload = ReturnType<typeof createMove>
export type OpenAndUploadPayload = ReturnType<typeof createOpenAndUpload>
export type OpenFilesFromWidgetPayload = ReturnType<typeof createOpenFilesFromWidget>
export type OpenLocalPathInSystemFileManagerPayload = ReturnType<
  typeof createOpenLocalPathInSystemFileManager
>
export type OpenPathInSystemFileManagerPayload = ReturnType<typeof createOpenPathInSystemFileManager>
export type OpenSecurityPreferencesPayload = ReturnType<typeof createOpenSecurityPreferences>
export type PickAndUploadPayload = ReturnType<typeof createPickAndUpload>
export type PlaceholderActionPayload = ReturnType<typeof createPlaceholderAction>
export type PollJournalStatusPayload = ReturnType<typeof createPollJournalStatus>
export type RefreshDriverStatusPayload = ReturnType<typeof createRefreshDriverStatus>
export type RefreshMountDirsAfter10sPayload = ReturnType<typeof createRefreshMountDirsAfter10s>
export type SaveMediaPayload = ReturnType<typeof createSaveMedia>
export type SetCriticalUpdatePayload = ReturnType<typeof createSetCriticalUpdate>
export type SetDebugLevelPayload = ReturnType<typeof createSetDebugLevel>
export type SetDriverStatusPayload = ReturnType<typeof createSetDriverStatus>
export type SetPathSoftErrorPayload = ReturnType<typeof createSetPathSoftError>
export type SetSfmiBannerDismissedPayload = ReturnType<typeof createSetSfmiBannerDismissed>
export type SetSpaceAvailableNotificationThresholdPayload = ReturnType<
  typeof createSetSpaceAvailableNotificationThreshold
>
export type SetTlfSoftErrorPayload = ReturnType<typeof createSetTlfSoftError>
export type SetTlfSyncConfigPayload = ReturnType<typeof createSetTlfSyncConfig>
export type SetTlfsAsUnloadedPayload = ReturnType<typeof createSetTlfsAsUnloaded>
export type ShareNativePayload = ReturnType<typeof createShareNative>
export type StartManualConflictResolutionPayload = ReturnType<typeof createStartManualConflictResolution>
export type SubscribeNonPathPayload = ReturnType<typeof createSubscribeNonPath>
export type SubscribePathPayload = ReturnType<typeof createSubscribePath>
export type TlfSyncConfigLoadedPayload = ReturnType<typeof createTlfSyncConfigLoaded>
export type UninstallKBFSConfirmPayload = ReturnType<typeof createUninstallKBFSConfirm>
export type UnsubscribePayload = ReturnType<typeof createUnsubscribe>
export type UploadFromDragAndDropPayload = ReturnType<typeof createUploadFromDragAndDrop>
export type UploadPayload = ReturnType<typeof createUpload>
export type UserFileEditsLoadPayload = ReturnType<typeof createUserFileEditsLoad>
export type UserFileEditsLoadedPayload = ReturnType<typeof createUserFileEditsLoaded>
export type UserInPayload = ReturnType<typeof createUserIn>
export type UserOutPayload = ReturnType<typeof createUserOut>

// All Actions
// prettier-ignore
export type Actions =
  | CancelDownloadPayload
  | CopyPayload
  | DeleteFilePayload
  | DismissDownloadPayload
  | DismissUploadPayload
  | DownloadPayload
  | DriverDisablePayload
  | DriverDisablingPayload
  | DriverEnablePayload
  | FavoriteIgnoreErrorPayload
  | FavoriteIgnorePayload
  | FavoritesLoadPayload
  | FavoritesLoadedPayload
  | FinishManualConflictResolutionPayload
  | FinishedDownloadWithIntentPayload
  | FinishedRegularDownloadPayload
  | GetOnlineStatusPayload
  | JournalUpdatePayload
  | KbfsDaemonRpcStatusChangedPayload
  | LetResetUserBackInPayload
  | LoadAdditionalTlfPayload
  | LoadDownloadInfoPayload
  | LoadDownloadStatusPayload
  | LoadFilesTabBadgePayload
  | LoadPathInfoPayload
  | LoadTlfSyncConfigPayload
  | LoadUploadStatusPayload
  | LoadedAdditionalTlfPayload
  | LoadedFilesTabBadgePayload
  | LoadedPathInfoPayload
  | LoadedUploadStatusPayload
  | MovePayload
  | OpenAndUploadPayload
  | OpenFilesFromWidgetPayload
  | OpenLocalPathInSystemFileManagerPayload
  | OpenPathInSystemFileManagerPayload
  | OpenSecurityPreferencesPayload
  | PickAndUploadPayload
  | PlaceholderActionPayload
  | PollJournalStatusPayload
  | RefreshDriverStatusPayload
  | RefreshMountDirsAfter10sPayload
  | SaveMediaPayload
  | SetCriticalUpdatePayload
  | SetDebugLevelPayload
  | SetDriverStatusPayload
  | SetPathSoftErrorPayload
  | SetSfmiBannerDismissedPayload
  | SetSpaceAvailableNotificationThresholdPayload
  | SetTlfSoftErrorPayload
  | SetTlfSyncConfigPayload
  | SetTlfsAsUnloadedPayload
  | ShareNativePayload
  | StartManualConflictResolutionPayload
  | SubscribeNonPathPayload
  | SubscribePathPayload
  | TlfSyncConfigLoadedPayload
  | UninstallKBFSConfirmPayload
  | UnsubscribePayload
  | UploadFromDragAndDropPayload
  | UploadPayload
  | UserFileEditsLoadPayload
  | UserFileEditsLoadedPayload
  | UserInPayload
  | UserOutPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
