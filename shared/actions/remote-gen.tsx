// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of remote but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'remote:'
export const closeUnlockFolders = 'remote:closeUnlockFolders'
export const dumpLogs = 'remote:dumpLogs'
export const installerRan = 'remote:installerRan'
export const link = 'remote:link'
export const openPathInSystemFileManager = 'remote:openPathInSystemFileManager'
export const pinentryOnCancel = 'remote:pinentryOnCancel'
export const pinentryOnSubmit = 'remote:pinentryOnSubmit'
export const powerMonitorEvent = 'remote:powerMonitorEvent'
export const remoteWindowWantsProps = 'remote:remoteWindowWantsProps'
export const saltpackFileOpen = 'remote:saltpackFileOpen'
export const setSystemDarkMode = 'remote:setSystemDarkMode'
export const showMain = 'remote:showMain'
export const stop = 'remote:stop'
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
 * Fired after OS notifies Electron that an associated Saltpack file has been opened.
 *
 * Path is a string when coming from Electron open-file event and HiddenString when coming from state.config.startupFile.
 */
export const createSaltpackFileOpen = (payload: {readonly path: string | HiddenString}) => ({
  payload,
  type: saltpackFileOpen as typeof saltpackFileOpen,
})
/**
 * Plumb power monitor events from node
 */
export const createPowerMonitorEvent = (payload: {readonly event: string}) => ({
  payload,
  type: powerMonitorEvent as typeof powerMonitorEvent,
})
/**
 * a window was shown
 */
export const createUpdateWindowShown = (payload: {readonly component: string}) => ({
  payload,
  type: updateWindowShown as typeof updateWindowShown,
})
/**
 * desktop only: the installer ran and we can start up
 */
export const createInstallerRan = (payload?: undefined) => ({
  payload,
  type: installerRan as typeof installerRan,
})
/**
 * main electron window changed max/min
 */
export const createUpdateWindowMaxState = (payload: {readonly max: boolean}) => ({
  payload,
  type: updateWindowMaxState as typeof updateWindowMaxState,
})
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
}) => ({payload, type: updateWindowState as typeof updateWindowState})
/**
 * remote electron window wants props sent
 */
export const createRemoteWindowWantsProps = (payload: {
  readonly component: string
  readonly param: string
}) => ({payload, type: remoteWindowWantsProps as typeof remoteWindowWantsProps})
export const createCloseUnlockFolders = (payload?: undefined) => ({
  payload,
  type: closeUnlockFolders as typeof closeUnlockFolders,
})
export const createDumpLogs = (payload: {readonly reason: 'quitting through menu'}) => ({
  payload,
  type: dumpLogs as typeof dumpLogs,
})
export const createLink = (payload: {readonly link: string}) => ({payload, type: link as typeof link})
export const createOpenPathInSystemFileManager = (payload: {readonly path: string}) => ({
  payload,
  type: openPathInSystemFileManager as typeof openPathInSystemFileManager,
})
export const createPinentryOnCancel = (payload?: undefined) => ({
  payload,
  type: pinentryOnCancel as typeof pinentryOnCancel,
})
export const createPinentryOnSubmit = (payload: {readonly password: string}) => ({
  payload,
  type: pinentryOnSubmit as typeof pinentryOnSubmit,
})
export const createSetSystemDarkMode = (payload: {readonly dark: boolean}) => ({
  payload,
  type: setSystemDarkMode as typeof setSystemDarkMode,
})
export const createShowMain = (payload?: undefined) => ({payload, type: showMain as typeof showMain})
export const createStop = (payload: {readonly exitCode: RPCTypes.ExitCode}) => ({
  payload,
  type: stop as typeof stop,
})
export const createTrackerChangeFollow = (payload: {readonly guiID: string; readonly follow: boolean}) => ({
  payload,
  type: trackerChangeFollow as typeof trackerChangeFollow,
})
export const createTrackerCloseTracker = (payload: {readonly guiID: string}) => ({
  payload,
  type: trackerCloseTracker as typeof trackerCloseTracker,
})
export const createTrackerIgnore = (payload: {readonly guiID: string}) => ({
  payload,
  type: trackerIgnore as typeof trackerIgnore,
})
export const createTrackerLoad = (payload: {
  readonly assertion: string
  readonly forceDisplay?: boolean
  readonly fromDaemon?: boolean
  readonly guiID: string
  readonly ignoreCache?: boolean
  readonly reason: string
  readonly inTracker: boolean
}) => ({payload, type: trackerLoad as typeof trackerLoad})
export const createUnlockFoldersSubmitPaperKey = (payload: {readonly paperKey: string}) => ({
  payload,
  type: unlockFoldersSubmitPaperKey as typeof unlockFoldersSubmitPaperKey,
})
export const createUpdateNow = (payload?: undefined) => ({payload, type: updateNow as typeof updateNow})

// Action Payloads
export type CloseUnlockFoldersPayload = ReturnType<typeof createCloseUnlockFolders>
export type DumpLogsPayload = ReturnType<typeof createDumpLogs>
export type InstallerRanPayload = ReturnType<typeof createInstallerRan>
export type LinkPayload = ReturnType<typeof createLink>
export type OpenPathInSystemFileManagerPayload = ReturnType<typeof createOpenPathInSystemFileManager>
export type PinentryOnCancelPayload = ReturnType<typeof createPinentryOnCancel>
export type PinentryOnSubmitPayload = ReturnType<typeof createPinentryOnSubmit>
export type PowerMonitorEventPayload = ReturnType<typeof createPowerMonitorEvent>
export type RemoteWindowWantsPropsPayload = ReturnType<typeof createRemoteWindowWantsProps>
export type SaltpackFileOpenPayload = ReturnType<typeof createSaltpackFileOpen>
export type SetSystemDarkModePayload = ReturnType<typeof createSetSystemDarkMode>
export type ShowMainPayload = ReturnType<typeof createShowMain>
export type StopPayload = ReturnType<typeof createStop>
export type TrackerChangeFollowPayload = ReturnType<typeof createTrackerChangeFollow>
export type TrackerCloseTrackerPayload = ReturnType<typeof createTrackerCloseTracker>
export type TrackerIgnorePayload = ReturnType<typeof createTrackerIgnore>
export type TrackerLoadPayload = ReturnType<typeof createTrackerLoad>
export type UnlockFoldersSubmitPaperKeyPayload = ReturnType<typeof createUnlockFoldersSubmitPaperKey>
export type UpdateNowPayload = ReturnType<typeof createUpdateNow>
export type UpdateWindowMaxStatePayload = ReturnType<typeof createUpdateWindowMaxState>
export type UpdateWindowShownPayload = ReturnType<typeof createUpdateWindowShown>
export type UpdateWindowStatePayload = ReturnType<typeof createUpdateWindowState>

// All Actions
// prettier-ignore
export type Actions =
  | CloseUnlockFoldersPayload
  | DumpLogsPayload
  | InstallerRanPayload
  | LinkPayload
  | OpenPathInSystemFileManagerPayload
  | PinentryOnCancelPayload
  | PinentryOnSubmitPayload
  | PowerMonitorEventPayload
  | RemoteWindowWantsPropsPayload
  | SaltpackFileOpenPayload
  | SetSystemDarkModePayload
  | ShowMainPayload
  | StopPayload
  | TrackerChangeFollowPayload
  | TrackerCloseTrackerPayload
  | TrackerIgnorePayload
  | TrackerLoadPayload
  | UnlockFoldersSubmitPaperKeyPayload
  | UpdateNowPayload
  | UpdateWindowMaxStatePayload
  | UpdateWindowShownPayload
  | UpdateWindowStatePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
