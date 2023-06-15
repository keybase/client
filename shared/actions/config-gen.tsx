// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/config'
import type * as Tabs from '../constants/tabs'
import type * as ChatTypes from '../constants/types/chat2'
import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of config but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'config:'
export const androidShare = 'config:androidShare'
export const bootstrapStatusLoaded = 'config:bootstrapStatusLoaded'
export const changedActive = 'config:changedActive'
export const changedFocus = 'config:changedFocus'
export const copyToClipboard = 'config:copyToClipboard'
export const daemonHandshake = 'config:daemonHandshake'
export const daemonHandshakeDone = 'config:daemonHandshakeDone'
export const darkModePreferenceChanged = 'config:darkModePreferenceChanged'
export const dumpLogs = 'config:dumpLogs'
export const filePickerError = 'config:filePickerError'
export const initListenerLoops = 'config:initListenerLoops'
export const installerRan = 'config:installerRan'
export const loadOnStart = 'config:loadOnStart'
export const loggedIn = 'config:loggedIn'
export const loggedOut = 'config:loggedOut'
export const logoutAndTryToLogInAs = 'config:logoutAndTryToLogInAs'
export const logoutHandshake = 'config:logoutHandshake'
export const mobileAppState = 'config:mobileAppState'
export const openAppSettings = 'config:openAppSettings'
export const openAppStore = 'config:openAppStore'
export const openAtLoginChanged = 'config:openAtLoginChanged'
export const osNetworkStatusChanged = 'config:osNetworkStatusChanged'
export const persistRoute = 'config:persistRoute'
export const powerMonitorEvent = 'config:powerMonitorEvent'
export const remoteWindowWantsProps = 'config:remoteWindowWantsProps'
export const restartHandshake = 'config:restartHandshake'
export const revoked = 'config:revoked'
export const setNavigator = 'config:setNavigator'
export const setStartupDetails = 'config:setStartupDetails'
export const setStartupFile = 'config:setStartupFile'
export const setSystemDarkMode = 'config:setSystemDarkMode'
export const showMain = 'config:showMain'
export const showShareActionSheet = 'config:showShareActionSheet'
export const updateMenubarWindowID = 'config:updateMenubarWindowID'
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
 * Log out the current user, keeping secrets stored.
 * Then prefill the username for provisioned another user to log in.
 */
export const createLogoutAndTryToLogInAs = (payload: {readonly username: string}) => ({
  payload,
  type: logoutAndTryToLogInAs as typeof logoutAndTryToLogInAs,
})
/**
 * Open a link to the app store
 */
export const createOpenAppStore = (payload?: undefined) => ({
  payload,
  type: openAppStore as typeof openAppStore,
})
/**
 * Plumb power monitor events from node
 */
export const createPowerMonitorEvent = (payload: {readonly event: string}) => ({
  payload,
  type: powerMonitorEvent as typeof powerMonitorEvent,
})
/**
 * Sent whenever the mobile file picker encounters an error.
 */
export const createFilePickerError = (payload: {readonly error: Error}) => ({
  payload,
  type: filePickerError as typeof filePickerError,
})
/**
 * Stores the startup file path when launching Keybase from a cold start beofre log in
 */
export const createSetStartupFile = (payload: {readonly startupFile: HiddenString}) => ({
  payload,
  type: setStartupFile as typeof setStartupFile,
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
 * Used internally to know we were logged in.
 * If you want to react to being logged in likely you want bootstrapStatusLoaded
 */
export const createLoggedIn = (payload: {
  readonly causedBySignup: boolean
  readonly causedByStartup: boolean
}) => ({payload, type: loggedIn as typeof loggedIn})
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
 * internal to config. should restart the handshake process
 */
export const createRestartHandshake = (payload?: undefined) => ({
  payload,
  type: restartHandshake as typeof restartHandshake,
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
 * mobile only: open the settings page
 */
export const createOpenAppSettings = (payload?: undefined) => ({
  payload,
  type: openAppSettings as typeof openAppSettings,
})
/**
 * ready to show the app
 */
export const createDaemonHandshakeDone = (payload?: undefined) => ({
  payload,
  type: daemonHandshakeDone as typeof daemonHandshakeDone,
})
/**
 * remote electron window wants props sent
 */
export const createRemoteWindowWantsProps = (payload: {
  readonly component: string
  readonly param: string
}) => ({payload, type: remoteWindowWantsProps as typeof remoteWindowWantsProps})
/**
 * starting the connect process. Things that need to happen before we see the app should call daemonHandshakeWait
 */
export const createDaemonHandshake = (payload: {
  readonly firstTimeConnecting: boolean
  readonly version: number
}) => ({payload, type: daemonHandshake as typeof daemonHandshake})
/**
 * starting the logout process. Things that need to happen before we see the app should call logoutHandshakeWait
 */
export const createLogoutHandshake = (payload: {readonly version: number}) => ({
  payload,
  type: logoutHandshake as typeof logoutHandshake,
})
export const createBootstrapStatusLoaded = (payload: {readonly loggedIn: boolean}) => ({
  payload,
  type: bootstrapStatusLoaded as typeof bootstrapStatusLoaded,
})
export const createChangedActive = (payload: {readonly userActive: boolean}) => ({
  payload,
  type: changedActive as typeof changedActive,
})
export const createChangedFocus = (payload: {readonly appFocused: boolean}) => ({
  payload,
  type: changedFocus as typeof changedFocus,
})
export const createCopyToClipboard = (payload: {readonly text: string}) => ({
  payload,
  type: copyToClipboard as typeof copyToClipboard,
})
export const createDarkModePreferenceChanged = (payload?: undefined) => ({
  payload,
  type: darkModePreferenceChanged as typeof darkModePreferenceChanged,
})
export const createDumpLogs = (payload: {readonly reason: 'quitting through menu'}) => ({
  payload,
  type: dumpLogs as typeof dumpLogs,
})
export const createLoggedOut = (payload?: undefined) => ({payload, type: loggedOut as typeof loggedOut})
export const createMobileAppState = (payload: {
  readonly nextAppState: 'active' | 'background' | 'inactive'
}) => ({payload, type: mobileAppState as typeof mobileAppState})
export const createOpenAtLoginChanged = (payload?: undefined) => ({
  payload,
  type: openAtLoginChanged as typeof openAtLoginChanged,
})
export const createOsNetworkStatusChanged = (payload: {
  readonly online: boolean
  readonly type: Types.ConnectionType
  readonly isInit?: boolean
}) => ({payload, type: osNetworkStatusChanged as typeof osNetworkStatusChanged})
export const createPersistRoute = (payload: {readonly path?: Array<any>} = {}) => ({
  payload,
  type: persistRoute as typeof persistRoute,
})
export const createRevoked = (payload?: undefined) => ({payload, type: revoked as typeof revoked})
export const createSetNavigator = (payload: {readonly navigator: any}) => ({
  payload,
  type: setNavigator as typeof setNavigator,
})
export const createSetStartupDetails = (payload: {
  readonly startupWasFromPush: boolean
  readonly startupConversation?: ChatTypes.ConversationIDKey
  readonly startupLink: string
  readonly startupTab?: Tabs.Tab
  readonly startupFollowUser: string
  readonly startupPushPayload?: string
}) => ({payload, type: setStartupDetails as typeof setStartupDetails})
export const createSetSystemDarkMode = (payload: {readonly dark: boolean}) => ({
  payload,
  type: setSystemDarkMode as typeof setSystemDarkMode,
})
export const createShowMain = (payload?: undefined) => ({payload, type: showMain as typeof showMain})
export const createShowShareActionSheet = (payload: {
  readonly filePath?: string
  readonly message?: string
  readonly mimeType: string
}) => ({payload, type: showShareActionSheet as typeof showShareActionSheet})
export const createUpdateMenubarWindowID = (payload: {readonly id: number}) => ({
  payload,
  type: updateMenubarWindowID as typeof updateMenubarWindowID,
})
export const createUpdateNow = (payload?: undefined) => ({payload, type: updateNow as typeof updateNow})

// Action Payloads
export type AndroidSharePayload = ReturnType<typeof createAndroidShare>
export type BootstrapStatusLoadedPayload = ReturnType<typeof createBootstrapStatusLoaded>
export type ChangedActivePayload = ReturnType<typeof createChangedActive>
export type ChangedFocusPayload = ReturnType<typeof createChangedFocus>
export type CopyToClipboardPayload = ReturnType<typeof createCopyToClipboard>
export type DaemonHandshakeDonePayload = ReturnType<typeof createDaemonHandshakeDone>
export type DaemonHandshakePayload = ReturnType<typeof createDaemonHandshake>
export type DarkModePreferenceChangedPayload = ReturnType<typeof createDarkModePreferenceChanged>
export type DumpLogsPayload = ReturnType<typeof createDumpLogs>
export type FilePickerErrorPayload = ReturnType<typeof createFilePickerError>
export type InitListenerLoopsPayload = ReturnType<typeof createInitListenerLoops>
export type InstallerRanPayload = ReturnType<typeof createInstallerRan>
export type LoadOnStartPayload = ReturnType<typeof createLoadOnStart>
export type LoggedInPayload = ReturnType<typeof createLoggedIn>
export type LoggedOutPayload = ReturnType<typeof createLoggedOut>
export type LogoutAndTryToLogInAsPayload = ReturnType<typeof createLogoutAndTryToLogInAs>
export type LogoutHandshakePayload = ReturnType<typeof createLogoutHandshake>
export type MobileAppStatePayload = ReturnType<typeof createMobileAppState>
export type OpenAppSettingsPayload = ReturnType<typeof createOpenAppSettings>
export type OpenAppStorePayload = ReturnType<typeof createOpenAppStore>
export type OpenAtLoginChangedPayload = ReturnType<typeof createOpenAtLoginChanged>
export type OsNetworkStatusChangedPayload = ReturnType<typeof createOsNetworkStatusChanged>
export type PersistRoutePayload = ReturnType<typeof createPersistRoute>
export type PowerMonitorEventPayload = ReturnType<typeof createPowerMonitorEvent>
export type RemoteWindowWantsPropsPayload = ReturnType<typeof createRemoteWindowWantsProps>
export type RestartHandshakePayload = ReturnType<typeof createRestartHandshake>
export type RevokedPayload = ReturnType<typeof createRevoked>
export type SetNavigatorPayload = ReturnType<typeof createSetNavigator>
export type SetStartupDetailsPayload = ReturnType<typeof createSetStartupDetails>
export type SetStartupFilePayload = ReturnType<typeof createSetStartupFile>
export type SetSystemDarkModePayload = ReturnType<typeof createSetSystemDarkMode>
export type ShowMainPayload = ReturnType<typeof createShowMain>
export type ShowShareActionSheetPayload = ReturnType<typeof createShowShareActionSheet>
export type UpdateMenubarWindowIDPayload = ReturnType<typeof createUpdateMenubarWindowID>
export type UpdateNowPayload = ReturnType<typeof createUpdateNow>
export type UpdateWindowMaxStatePayload = ReturnType<typeof createUpdateWindowMaxState>
export type UpdateWindowShownPayload = ReturnType<typeof createUpdateWindowShown>
export type UpdateWindowStatePayload = ReturnType<typeof createUpdateWindowState>

// All Actions
// prettier-ignore
export type Actions =
  | AndroidSharePayload
  | BootstrapStatusLoadedPayload
  | ChangedActivePayload
  | ChangedFocusPayload
  | CopyToClipboardPayload
  | DaemonHandshakeDonePayload
  | DaemonHandshakePayload
  | DarkModePreferenceChangedPayload
  | DumpLogsPayload
  | FilePickerErrorPayload
  | InitListenerLoopsPayload
  | InstallerRanPayload
  | LoadOnStartPayload
  | LoggedInPayload
  | LoggedOutPayload
  | LogoutAndTryToLogInAsPayload
  | LogoutHandshakePayload
  | MobileAppStatePayload
  | OpenAppSettingsPayload
  | OpenAppStorePayload
  | OpenAtLoginChangedPayload
  | OsNetworkStatusChangedPayload
  | PersistRoutePayload
  | PowerMonitorEventPayload
  | RemoteWindowWantsPropsPayload
  | RestartHandshakePayload
  | RevokedPayload
  | SetNavigatorPayload
  | SetStartupDetailsPayload
  | SetStartupFilePayload
  | SetSystemDarkModePayload
  | ShowMainPayload
  | ShowShareActionSheetPayload
  | UpdateMenubarWindowIDPayload
  | UpdateNowPayload
  | UpdateWindowMaxStatePayload
  | UpdateWindowShownPayload
  | UpdateWindowStatePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
