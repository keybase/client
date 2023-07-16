// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of config but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'config:'
export const androidShare = 'config:androidShare'
export const darkModePreferenceChanged = 'config:darkModePreferenceChanged'
export const initListenerLoops = 'config:initListenerLoops'
export const loadOnStart = 'config:loadOnStart'
export const powerMonitorEvent = 'config:powerMonitorEvent'
export const remoteWindowWantsProps = 'config:remoteWindowWantsProps'
export const revoked = 'config:revoked'
export const setSystemDarkMode = 'config:setSystemDarkMode'
export const showShareActionSheet = 'config:showShareActionSheet'
export const updateNow = 'config:updateNow'
export const updateWindowMaxState = 'config:updateWindowMaxState'
export const updateWindowShown = 'config:updateWindowShown'
export const updateWindowState = 'config:updateWindowState'

// Action Creators
/**
 * Intent fired with a share url
 */
export const createAndroidShare = (payload: {readonly url?: string; readonly text?: string} = {}) => ({
  payload,
  type: androidShare as typeof androidShare,
})
/**
 * Internal action just to start saga-like spawn processes
 */
export const createInitListenerLoops = (payload?: undefined) => ({
  payload,
  type: initListenerLoops as typeof initListenerLoops,
})
/**
 * Plumb power monitor events from node
 */
export const createPowerMonitorEvent = (payload: {readonly event: string}) => ({
  payload,
  type: powerMonitorEvent as typeof powerMonitorEvent,
})
/**
 * This action is dispatched multiple times with various flags.
 * If you want to do something as a result of startup or login listen to this.
 */
export const createLoadOnStart = (payload: {
  readonly phase:
    | 'initialStartupAsEarlyAsPossible'
    | 'connectedToDaemonForFirstTime'
    | 'reloggedIn'
    | 'startupOrReloginButNotInARush'
}) => ({payload, type: loadOnStart as typeof loadOnStart})
/**
 * a window was shown
 */
export const createUpdateWindowShown = (payload: {readonly component: string}) => ({
  payload,
  type: updateWindowShown as typeof updateWindowShown,
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
export const createDarkModePreferenceChanged = (payload?: undefined) => ({
  payload,
  type: darkModePreferenceChanged as typeof darkModePreferenceChanged,
})
export const createRevoked = (payload?: undefined) => ({payload, type: revoked as typeof revoked})
export const createSetSystemDarkMode = (payload: {readonly dark: boolean}) => ({
  payload,
  type: setSystemDarkMode as typeof setSystemDarkMode,
})
export const createShowShareActionSheet = (payload: {
  readonly filePath?: string
  readonly message?: string
  readonly mimeType: string
}) => ({payload, type: showShareActionSheet as typeof showShareActionSheet})
export const createUpdateNow = (payload?: undefined) => ({payload, type: updateNow as typeof updateNow})

// Action Payloads
export type AndroidSharePayload = ReturnType<typeof createAndroidShare>
export type DarkModePreferenceChangedPayload = ReturnType<typeof createDarkModePreferenceChanged>
export type InitListenerLoopsPayload = ReturnType<typeof createInitListenerLoops>
export type LoadOnStartPayload = ReturnType<typeof createLoadOnStart>
export type PowerMonitorEventPayload = ReturnType<typeof createPowerMonitorEvent>
export type RemoteWindowWantsPropsPayload = ReturnType<typeof createRemoteWindowWantsProps>
export type RevokedPayload = ReturnType<typeof createRevoked>
export type SetSystemDarkModePayload = ReturnType<typeof createSetSystemDarkMode>
export type ShowShareActionSheetPayload = ReturnType<typeof createShowShareActionSheet>
export type UpdateNowPayload = ReturnType<typeof createUpdateNow>
export type UpdateWindowMaxStatePayload = ReturnType<typeof createUpdateWindowMaxState>
export type UpdateWindowShownPayload = ReturnType<typeof createUpdateWindowShown>
export type UpdateWindowStatePayload = ReturnType<typeof createUpdateWindowState>

// All Actions
// prettier-ignore
export type Actions =
  | AndroidSharePayload
  | DarkModePreferenceChangedPayload
  | InitListenerLoopsPayload
  | LoadOnStartPayload
  | PowerMonitorEventPayload
  | RemoteWindowWantsPropsPayload
  | RevokedPayload
  | SetSystemDarkModePayload
  | ShowShareActionSheetPayload
  | UpdateNowPayload
  | UpdateWindowMaxStatePayload
  | UpdateWindowShownPayload
  | UpdateWindowStatePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
