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
export const checkForUpdate = 'config:checkForUpdate'
export const copyToClipboard = 'config:copyToClipboard'
export const daemonHandshake = 'config:daemonHandshake'
export const daemonHandshakeDone = 'config:daemonHandshakeDone'
export const darkModePreferenceChanged = 'config:darkModePreferenceChanged'
export const dumpLogs = 'config:dumpLogs'
export const filePickerError = 'config:filePickerError'
export const initListenerLoops = 'config:initListenerLoops'
export const installerRan = 'config:installerRan'
export const loadOnLoginStartup = 'config:loadOnLoginStartup'
export const loadOnStart = 'config:loadOnStart'
export const loadedOnLoginStartup = 'config:loadedOnLoginStartup'
export const loggedIn = 'config:loggedIn'
export const loggedOut = 'config:loggedOut'
export const logout = 'config:logout'
export const logoutAndTryToLogInAs = 'config:logoutAndTryToLogInAs'
export const logoutHandshake = 'config:logoutHandshake'
export const logoutHandshakeWait = 'config:logoutHandshakeWait'
export const mobileAppState = 'config:mobileAppState'
export const openAppSettings = 'config:openAppSettings'
export const openAppStore = 'config:openAppStore'
export const osNetworkStatusChanged = 'config:osNetworkStatusChanged'
export const persistRoute = 'config:persistRoute'
export const powerMonitorEvent = 'config:powerMonitorEvent'
export const pushLoaded = 'config:pushLoaded'
export const remoteWindowWantsProps = 'config:remoteWindowWantsProps'
export const restartHandshake = 'config:restartHandshake'
export const revoked = 'config:revoked'
export const setDeletedSelf = 'config:setDeletedSelf'
export const setNavigator = 'config:setNavigator'
export const setNotifySound = 'config:setNotifySound'
export const setOpenAtLogin = 'config:setOpenAtLogin'
export const setStartupDetails = 'config:setStartupDetails'
export const setStartupFile = 'config:setStartupFile'
export const setSystemDarkMode = 'config:setSystemDarkMode'
export const setUseNativeFrame = 'config:setUseNativeFrame'
export const setUserSwitching = 'config:setUserSwitching'
export const setWhatsNewLastSeenVersion = 'config:setWhatsNewLastSeenVersion'
export const showMain = 'config:showMain'
export const showShareActionSheet = 'config:showShareActionSheet'
export const toggleRuntimeStats = 'config:toggleRuntimeStats'
export const updateCriticalCheckStatus = 'config:updateCriticalCheckStatus'
export const updateInfo = 'config:updateInfo'
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
 * Save critical check status
 */
export const createUpdateCriticalCheckStatus = (payload: {
  readonly status: 'critical' | 'suggested' | 'ok'
  readonly message: string
}) => ({payload, type: updateCriticalCheckStatus as typeof updateCriticalCheckStatus})
/**
 * Sent whenever the mobile file picker encounters an error.
 */
export const createFilePickerError = (payload: {readonly error: Error}) => ({
  payload,
  type: filePickerError as typeof filePickerError,
})
/**
 * Set the latest version number that a user has seen from Gregor.
 * This is used to set the badged state of the 'What's New' radio icon
 */
export const createSetWhatsNewLastSeenVersion = (payload: {readonly lastSeenVersion: string}) => ({
  payload,
  type: setWhatsNewLastSeenVersion as typeof setWhatsNewLastSeenVersion,
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
export const createUpdateWindowState = (payload: {readonly windowState: Types.WindowState}) => ({
  payload,
  type: updateWindowState as typeof updateWindowState,
})
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
 * someone wants to log out
 */
export const createLogout = (payload?: undefined) => ({payload, type: logout as typeof logout})
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
/**
 * subsystems that need to do things during logout need to call this to register that we should wait.
 */
export const createLogoutHandshakeWait = (payload: {
  readonly name: string
  readonly version: number
  readonly increment: boolean
}) => ({payload, type: logoutHandshakeWait as typeof logoutHandshakeWait})
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
export const createCheckForUpdate = (payload?: undefined) => ({
  payload,
  type: checkForUpdate as typeof checkForUpdate,
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
export const createLoadOnLoginStartup = (payload?: undefined) => ({
  payload,
  type: loadOnLoginStartup as typeof loadOnLoginStartup,
})
export const createLoadedOnLoginStartup = (payload: {readonly status?: boolean} = {}) => ({
  payload,
  type: loadedOnLoginStartup as typeof loadedOnLoginStartup,
})
export const createLoggedOut = (payload?: undefined) => ({payload, type: loggedOut as typeof loggedOut})
export const createMobileAppState = (payload: {
  readonly nextAppState: 'active' | 'background' | 'inactive'
}) => ({payload, type: mobileAppState as typeof mobileAppState})
export const createOsNetworkStatusChanged = (payload: {
  readonly online: boolean
  readonly type: Types.ConnectionType
  readonly isInit?: boolean
}) => ({payload, type: osNetworkStatusChanged as typeof osNetworkStatusChanged})
export const createPersistRoute = (payload: {readonly path?: Array<any>} = {}) => ({
  payload,
  type: persistRoute as typeof persistRoute,
})
export const createPushLoaded = (payload: {readonly pushLoaded: boolean}) => ({
  payload,
  type: pushLoaded as typeof pushLoaded,
})
export const createRevoked = (payload: {
  readonly deviceID: string
  readonly wasCurrentDevice: boolean
  readonly deviceName: string
}) => ({payload, type: revoked as typeof revoked})
export const createSetDeletedSelf = (payload: {readonly deletedUsername: string}) => ({
  payload,
  type: setDeletedSelf as typeof setDeletedSelf,
})
export const createSetNavigator = (payload: {readonly navigator: any}) => ({
  payload,
  type: setNavigator as typeof setNavigator,
})
export const createSetNotifySound = (payload: {readonly notifySound: boolean}) => ({
  payload,
  type: setNotifySound as typeof setNotifySound,
})
export const createSetOpenAtLogin = (payload: {readonly openAtLogin: boolean}) => ({
  payload,
  type: setOpenAtLogin as typeof setOpenAtLogin,
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
export const createSetUseNativeFrame = (payload: {readonly useNativeFrame: boolean}) => ({
  payload,
  type: setUseNativeFrame as typeof setUseNativeFrame,
})
export const createSetUserSwitching = (payload: {readonly userSwitching: boolean}) => ({
  payload,
  type: setUserSwitching as typeof setUserSwitching,
})
export const createShowMain = (payload?: undefined) => ({payload, type: showMain as typeof showMain})
export const createShowShareActionSheet = (payload: {
  readonly filePath?: string
  readonly message?: string
  readonly mimeType: string
}) => ({payload, type: showShareActionSheet as typeof showShareActionSheet})
export const createToggleRuntimeStats = (payload?: undefined) => ({
  payload,
  type: toggleRuntimeStats as typeof toggleRuntimeStats,
})
export const createUpdateInfo = (payload: {
  readonly isOutOfDate: boolean
  readonly critical: boolean
  readonly message?: string
}) => ({payload, type: updateInfo as typeof updateInfo})
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
export type CheckForUpdatePayload = ReturnType<typeof createCheckForUpdate>
export type CopyToClipboardPayload = ReturnType<typeof createCopyToClipboard>
export type DaemonHandshakeDonePayload = ReturnType<typeof createDaemonHandshakeDone>
export type DaemonHandshakePayload = ReturnType<typeof createDaemonHandshake>
export type DarkModePreferenceChangedPayload = ReturnType<typeof createDarkModePreferenceChanged>
export type DumpLogsPayload = ReturnType<typeof createDumpLogs>
export type FilePickerErrorPayload = ReturnType<typeof createFilePickerError>
export type InitListenerLoopsPayload = ReturnType<typeof createInitListenerLoops>
export type InstallerRanPayload = ReturnType<typeof createInstallerRan>
export type LoadOnLoginStartupPayload = ReturnType<typeof createLoadOnLoginStartup>
export type LoadOnStartPayload = ReturnType<typeof createLoadOnStart>
export type LoadedOnLoginStartupPayload = ReturnType<typeof createLoadedOnLoginStartup>
export type LoggedInPayload = ReturnType<typeof createLoggedIn>
export type LoggedOutPayload = ReturnType<typeof createLoggedOut>
export type LogoutAndTryToLogInAsPayload = ReturnType<typeof createLogoutAndTryToLogInAs>
export type LogoutHandshakePayload = ReturnType<typeof createLogoutHandshake>
export type LogoutHandshakeWaitPayload = ReturnType<typeof createLogoutHandshakeWait>
export type LogoutPayload = ReturnType<typeof createLogout>
export type MobileAppStatePayload = ReturnType<typeof createMobileAppState>
export type OpenAppSettingsPayload = ReturnType<typeof createOpenAppSettings>
export type OpenAppStorePayload = ReturnType<typeof createOpenAppStore>
export type OsNetworkStatusChangedPayload = ReturnType<typeof createOsNetworkStatusChanged>
export type PersistRoutePayload = ReturnType<typeof createPersistRoute>
export type PowerMonitorEventPayload = ReturnType<typeof createPowerMonitorEvent>
export type PushLoadedPayload = ReturnType<typeof createPushLoaded>
export type RemoteWindowWantsPropsPayload = ReturnType<typeof createRemoteWindowWantsProps>
export type RestartHandshakePayload = ReturnType<typeof createRestartHandshake>
export type RevokedPayload = ReturnType<typeof createRevoked>
export type SetDeletedSelfPayload = ReturnType<typeof createSetDeletedSelf>
export type SetNavigatorPayload = ReturnType<typeof createSetNavigator>
export type SetNotifySoundPayload = ReturnType<typeof createSetNotifySound>
export type SetOpenAtLoginPayload = ReturnType<typeof createSetOpenAtLogin>
export type SetStartupDetailsPayload = ReturnType<typeof createSetStartupDetails>
export type SetStartupFilePayload = ReturnType<typeof createSetStartupFile>
export type SetSystemDarkModePayload = ReturnType<typeof createSetSystemDarkMode>
export type SetUseNativeFramePayload = ReturnType<typeof createSetUseNativeFrame>
export type SetUserSwitchingPayload = ReturnType<typeof createSetUserSwitching>
export type SetWhatsNewLastSeenVersionPayload = ReturnType<typeof createSetWhatsNewLastSeenVersion>
export type ShowMainPayload = ReturnType<typeof createShowMain>
export type ShowShareActionSheetPayload = ReturnType<typeof createShowShareActionSheet>
export type ToggleRuntimeStatsPayload = ReturnType<typeof createToggleRuntimeStats>
export type UpdateCriticalCheckStatusPayload = ReturnType<typeof createUpdateCriticalCheckStatus>
export type UpdateInfoPayload = ReturnType<typeof createUpdateInfo>
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
  | CheckForUpdatePayload
  | CopyToClipboardPayload
  | DaemonHandshakeDonePayload
  | DaemonHandshakePayload
  | DarkModePreferenceChangedPayload
  | DumpLogsPayload
  | FilePickerErrorPayload
  | InitListenerLoopsPayload
  | InstallerRanPayload
  | LoadOnLoginStartupPayload
  | LoadOnStartPayload
  | LoadedOnLoginStartupPayload
  | LoggedInPayload
  | LoggedOutPayload
  | LogoutAndTryToLogInAsPayload
  | LogoutHandshakePayload
  | LogoutHandshakeWaitPayload
  | LogoutPayload
  | MobileAppStatePayload
  | OpenAppSettingsPayload
  | OpenAppStorePayload
  | OsNetworkStatusChangedPayload
  | PersistRoutePayload
  | PowerMonitorEventPayload
  | PushLoadedPayload
  | RemoteWindowWantsPropsPayload
  | RestartHandshakePayload
  | RevokedPayload
  | SetDeletedSelfPayload
  | SetNavigatorPayload
  | SetNotifySoundPayload
  | SetOpenAtLoginPayload
  | SetStartupDetailsPayload
  | SetStartupFilePayload
  | SetSystemDarkModePayload
  | SetUseNativeFramePayload
  | SetUserSwitchingPayload
  | SetWhatsNewLastSeenVersionPayload
  | ShowMainPayload
  | ShowShareActionSheetPayload
  | ToggleRuntimeStatsPayload
  | UpdateCriticalCheckStatusPayload
  | UpdateInfoPayload
  | UpdateMenubarWindowIDPayload
  | UpdateNowPayload
  | UpdateWindowMaxStatePayload
  | UpdateWindowShownPayload
  | UpdateWindowStatePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
