// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '@/constants/types/rpc-gen'
import type HiddenString from '@/util/hidden-string'
import type * as Tabs from '@/constants/tabs'

// Constants
export const resetStore = 'common:resetStore' // not a part of remote but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'remote:'
export const closeUnlockFolders = 'remote:closeUnlockFolders'
export const dumpLogs = 'remote:dumpLogs'
export const engineConnection = 'remote:engineConnection'
export const inboxRefresh = 'remote:inboxRefresh'
export const installerRan = 'remote:installerRan'
export const link = 'remote:link'
export const openChatFromWidget = 'remote:openChatFromWidget'
export const openFilesFromWidget = 'remote:openFilesFromWidget'
export const openPathInSystemFileManager = 'remote:openPathInSystemFileManager'
export const pinentryOnCancel = 'remote:pinentryOnCancel'
export const pinentryOnSubmit = 'remote:pinentryOnSubmit'
export const powerMonitorEvent = 'remote:powerMonitorEvent'
export const previewConversation = 'remote:previewConversation'
export const remoteWindowWantsProps = 'remote:remoteWindowWantsProps'
export const saltpackFileOpen = 'remote:saltpackFileOpen'
export const setCriticalUpdate = 'remote:setCriticalUpdate'
export const setSystemDarkMode = 'remote:setSystemDarkMode'
export const showMain = 'remote:showMain'
export const stop = 'remote:stop'
export const switchTab = 'remote:switchTab'
export const trackerChangeFollow = 'remote:trackerChangeFollow'
export const trackerCloseTracker = 'remote:trackerCloseTracker'
export const trackerIgnore = 'remote:trackerIgnore'
export const trackerLoad = 'remote:trackerLoad'
export const unlockFoldersSubmitPaperKey = 'remote:unlockFoldersSubmitPaperKey'
export const updateNow = 'remote:updateNow'
export const updateWindowMaxState = 'remote:updateWindowMaxState'
export const updateWindowShown = 'remote:updateWindowShown'
export const updateWindowState = 'remote:updateWindowState'
export const userFileEditsLoad = 'remote:userFileEditsLoad'

// Action Creators
/**
 * desktop only: the installer ran and we can start up
 */
export const createInstallerRan = (payload?: undefined) => ({payload, type: installerRan}) as const
/**
 * main electron window wants to store its state
 */
export const createUpdateWindowState = (payload: {
  readonly windowState: {
    dockHidden: boolean
    height: number
    isFullScreen: boolean
    width: number
    windowHidden: boolean
    x: number
    y: number
  }
}) => ({payload, type: updateWindowState}) as const
/**
 * remote electron window wants props sent
 */
export const createRemoteWindowWantsProps = (payload: {readonly component: string; readonly param: string}) =>
  ({payload, type: remoteWindowWantsProps}) as const
export const createCloseUnlockFolders = (payload?: undefined) =>
  ({payload, type: closeUnlockFolders}) as const
export const createDumpLogs = (payload: {readonly reason: 'quitting through menu'}) =>
  ({payload, type: dumpLogs}) as const
export const createEngineConnection = (payload: {readonly connected: boolean}) =>
  ({payload, type: engineConnection}) as const
export const createInboxRefresh = (payload?: undefined) => ({payload, type: inboxRefresh}) as const
export const createLink = (payload: {readonly link: string}) => ({payload, type: link}) as const
export const createOpenChatFromWidget = (payload: {readonly conversationIDKey: string}) =>
  ({payload, type: openChatFromWidget}) as const
export const createOpenFilesFromWidget = (payload: {readonly path: string}) =>
  ({payload, type: openFilesFromWidget}) as const
export const createOpenPathInSystemFileManager = (payload: {readonly path: string}) =>
  ({payload, type: openPathInSystemFileManager}) as const
export const createPinentryOnCancel = (payload?: undefined) => ({payload, type: pinentryOnCancel}) as const
export const createPinentryOnSubmit = (payload: {readonly password: string}) =>
  ({payload, type: pinentryOnSubmit}) as const
export const createPowerMonitorEvent = (payload: {readonly event: string}) =>
  ({payload, type: powerMonitorEvent}) as const
export const createPreviewConversation = (payload: {readonly participant: string}) =>
  ({payload, type: previewConversation}) as const
export const createSaltpackFileOpen = (payload: {readonly path: string | HiddenString}) =>
  ({payload, type: saltpackFileOpen}) as const
export const createSetCriticalUpdate = (payload: {readonly critical: boolean}) =>
  ({payload, type: setCriticalUpdate}) as const
export const createSetSystemDarkMode = (payload: {readonly dark: boolean}) =>
  ({payload, type: setSystemDarkMode}) as const
export const createShowMain = (payload?: undefined) => ({payload, type: showMain}) as const
export const createStop = (payload: {readonly exitCode: RPCTypes.ExitCode}) =>
  ({payload, type: stop}) as const
export const createSwitchTab = (payload: {readonly tab: Tabs.AppTab}) => ({payload, type: switchTab}) as const
export const createTrackerChangeFollow = (payload: {readonly guiID: string; readonly follow: boolean}) =>
  ({payload, type: trackerChangeFollow}) as const
export const createTrackerCloseTracker = (payload: {readonly guiID: string}) =>
  ({payload, type: trackerCloseTracker}) as const
export const createTrackerIgnore = (payload: {readonly guiID: string}) =>
  ({payload, type: trackerIgnore}) as const
export const createTrackerLoad = (payload: {
  readonly assertion: string
  readonly forceDisplay?: boolean
  readonly fromDaemon?: boolean
  readonly guiID: string
  readonly ignoreCache?: boolean
  readonly reason: string
  readonly inTracker: boolean
}) => ({payload, type: trackerLoad}) as const
export const createUnlockFoldersSubmitPaperKey = (payload: {readonly paperKey: string}) =>
  ({payload, type: unlockFoldersSubmitPaperKey}) as const
export const createUpdateNow = (payload?: undefined) => ({payload, type: updateNow}) as const
export const createUpdateWindowMaxState = (payload: {readonly max: boolean}) =>
  ({payload, type: updateWindowMaxState}) as const
export const createUpdateWindowShown = (payload: {readonly component: string}) =>
  ({payload, type: updateWindowShown}) as const
export const createUserFileEditsLoad = (payload?: undefined) => ({payload, type: userFileEditsLoad}) as const

// Action Payloads
export type CloseUnlockFoldersPayload = ReturnType<typeof createCloseUnlockFolders>
export type DumpLogsPayload = ReturnType<typeof createDumpLogs>
export type EngineConnectionPayload = ReturnType<typeof createEngineConnection>
export type InboxRefreshPayload = ReturnType<typeof createInboxRefresh>
export type InstallerRanPayload = ReturnType<typeof createInstallerRan>
export type LinkPayload = ReturnType<typeof createLink>
export type OpenChatFromWidgetPayload = ReturnType<typeof createOpenChatFromWidget>
export type OpenFilesFromWidgetPayload = ReturnType<typeof createOpenFilesFromWidget>
export type OpenPathInSystemFileManagerPayload = ReturnType<typeof createOpenPathInSystemFileManager>
export type PinentryOnCancelPayload = ReturnType<typeof createPinentryOnCancel>
export type PinentryOnSubmitPayload = ReturnType<typeof createPinentryOnSubmit>
export type PowerMonitorEventPayload = ReturnType<typeof createPowerMonitorEvent>
export type PreviewConversationPayload = ReturnType<typeof createPreviewConversation>
export type RemoteWindowWantsPropsPayload = ReturnType<typeof createRemoteWindowWantsProps>
export type SaltpackFileOpenPayload = ReturnType<typeof createSaltpackFileOpen>
export type SetCriticalUpdatePayload = ReturnType<typeof createSetCriticalUpdate>
export type SetSystemDarkModePayload = ReturnType<typeof createSetSystemDarkMode>
export type ShowMainPayload = ReturnType<typeof createShowMain>
export type StopPayload = ReturnType<typeof createStop>
export type SwitchTabPayload = ReturnType<typeof createSwitchTab>
export type TrackerChangeFollowPayload = ReturnType<typeof createTrackerChangeFollow>
export type TrackerCloseTrackerPayload = ReturnType<typeof createTrackerCloseTracker>
export type TrackerIgnorePayload = ReturnType<typeof createTrackerIgnore>
export type TrackerLoadPayload = ReturnType<typeof createTrackerLoad>
export type UnlockFoldersSubmitPaperKeyPayload = ReturnType<typeof createUnlockFoldersSubmitPaperKey>
export type UpdateNowPayload = ReturnType<typeof createUpdateNow>
export type UpdateWindowMaxStatePayload = ReturnType<typeof createUpdateWindowMaxState>
export type UpdateWindowShownPayload = ReturnType<typeof createUpdateWindowShown>
export type UpdateWindowStatePayload = ReturnType<typeof createUpdateWindowState>
export type UserFileEditsLoadPayload = ReturnType<typeof createUserFileEditsLoad>

// All Actions
// prettier-ignore
export type Actions =
  | CloseUnlockFoldersPayload
  | DumpLogsPayload
  | EngineConnectionPayload
  | InboxRefreshPayload
  | InstallerRanPayload
  | LinkPayload
  | OpenChatFromWidgetPayload
  | OpenFilesFromWidgetPayload
  | OpenPathInSystemFileManagerPayload
  | PinentryOnCancelPayload
  | PinentryOnSubmitPayload
  | PowerMonitorEventPayload
  | PreviewConversationPayload
  | RemoteWindowWantsPropsPayload
  | SaltpackFileOpenPayload
  | SetCriticalUpdatePayload
  | SetSystemDarkModePayload
  | ShowMainPayload
  | StopPayload
  | SwitchTabPayload
  | TrackerChangeFollowPayload
  | TrackerCloseTrackerPayload
  | TrackerIgnorePayload
  | TrackerLoadPayload
  | UnlockFoldersSubmitPaperKeyPayload
  | UpdateNowPayload
  | UpdateWindowMaxStatePayload
  | UpdateWindowShownPayload
  | UpdateWindowStatePayload
  | UserFileEditsLoadPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
