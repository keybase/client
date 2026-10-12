import type * as RPCTypes from '@/constants/rpc/rpc-gen'
import type * as Tabs from '@/constants/tabs'
import type HiddenString from '@/util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of remote but is handled by every reducer. NEVER dispatch this
export const closeUnlockFolders = 'remote:closeUnlockFolders'
export const dumpLogs = 'remote:dumpLogs'
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
export const saltpackFileOpen = 'remote:saltpackFileOpen'
export const setCriticalUpdate = 'remote:setCriticalUpdate'
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
export const createCloseUnlockFolders = (payload?: undefined) =>
  ({payload, type: closeUnlockFolders}) as const
export const createDumpLogs = (payload: {readonly reason: 'quitting through menu'}) =>
  ({payload, type: dumpLogs}) as const
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
export const createShowMain = (payload?: undefined) => ({payload, type: showMain}) as const
export const createStop = (payload: {readonly exitCode: RPCTypes.ExitCode}) =>
  ({payload, type: stop}) as const
export const createSwitchTab = (payload: {readonly tab: Tabs.AppTab}) => ({payload, type: switchTab}) as const
export const createTrackerChangeFollow = (payload: {readonly follow: boolean; readonly guiID: string}) =>
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
  readonly inTracker: boolean
  readonly reason: string
}) => ({payload, type: trackerLoad}) as const
export const createUnlockFoldersSubmitPaperKey = (payload: {readonly paperKey: string}) =>
  ({payload, type: unlockFoldersSubmitPaperKey}) as const
export const createUpdateNow = (payload?: undefined) => ({payload, type: updateNow}) as const
export const createUpdateWindowMaxState = (payload: {readonly max: boolean}) =>
  ({payload, type: updateWindowMaxState}) as const
export const createUpdateWindowShown = (payload: {readonly component: string}) =>
  ({payload, type: updateWindowShown}) as const

// Action Payloads
type CloseUnlockFoldersPayload = ReturnType<typeof createCloseUnlockFolders>
type DumpLogsPayload = ReturnType<typeof createDumpLogs>
type InboxRefreshPayload = ReturnType<typeof createInboxRefresh>
type InstallerRanPayload = ReturnType<typeof createInstallerRan>
type LinkPayload = ReturnType<typeof createLink>
type OpenChatFromWidgetPayload = ReturnType<typeof createOpenChatFromWidget>
type OpenFilesFromWidgetPayload = ReturnType<typeof createOpenFilesFromWidget>
type OpenPathInSystemFileManagerPayload = ReturnType<typeof createOpenPathInSystemFileManager>
export type PinentryOnCancelPayload = ReturnType<typeof createPinentryOnCancel>
export type PinentryOnSubmitPayload = ReturnType<typeof createPinentryOnSubmit>
type PowerMonitorEventPayload = ReturnType<typeof createPowerMonitorEvent>
type PreviewConversationPayload = ReturnType<typeof createPreviewConversation>
type SaltpackFileOpenPayload = ReturnType<typeof createSaltpackFileOpen>
type SetCriticalUpdatePayload = ReturnType<typeof createSetCriticalUpdate>
type ShowMainPayload = ReturnType<typeof createShowMain>
type StopPayload = ReturnType<typeof createStop>
type SwitchTabPayload = ReturnType<typeof createSwitchTab>
export type TrackerChangeFollowPayload = ReturnType<typeof createTrackerChangeFollow>
export type TrackerCloseTrackerPayload = ReturnType<typeof createTrackerCloseTracker>
export type TrackerIgnorePayload = ReturnType<typeof createTrackerIgnore>
export type TrackerLoadPayload = ReturnType<typeof createTrackerLoad>
type UnlockFoldersSubmitPaperKeyPayload = ReturnType<typeof createUnlockFoldersSubmitPaperKey>
type UpdateNowPayload = ReturnType<typeof createUpdateNow>
type UpdateWindowMaxStatePayload = ReturnType<typeof createUpdateWindowMaxState>
type UpdateWindowShownPayload = ReturnType<typeof createUpdateWindowShown>
type UpdateWindowStatePayload = ReturnType<typeof createUpdateWindowState>

// All Actions
// prettier-ignore
export type Actions =
  | CloseUnlockFoldersPayload
  | DumpLogsPayload
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
  | SaltpackFileOpenPayload
  | SetCriticalUpdatePayload
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
  | {readonly payload: undefined; readonly type: 'common:resetStore'}
