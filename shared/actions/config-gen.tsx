// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as RPCTypes from '../constants/types/rpc-gen'
import {ConnectionType} from '../constants/types/config'
import * as Tabs from '../constants/tabs'
import * as ChatTypes from '../constants/types/chat2'
import * as FsTypes from '../constants/types/fs'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of config but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'config:'
export const bootstrapStatusLoaded = 'config:bootstrapStatusLoaded'
export const changedActive = 'config:changedActive'
export const changedFocus = 'config:changedFocus'
export const checkForUpdate = 'config:checkForUpdate'
export const copyToClipboard = 'config:copyToClipboard'
export const daemonError = 'config:daemonError'
export const daemonHandshake = 'config:daemonHandshake'
export const daemonHandshakeDone = 'config:daemonHandshakeDone'
export const daemonHandshakeWait = 'config:daemonHandshakeWait'
export const dumpLogs = 'config:dumpLogs'
export const filePickerError = 'config:filePickerError'
export const followerInfoUpdated = 'config:followerInfoUpdated'
export const globalError = 'config:globalError'
export const installerRan = 'config:installerRan'
export const loggedIn = 'config:loggedIn'
export const loggedOut = 'config:loggedOut'
export const logout = 'config:logout'
export const logoutHandshake = 'config:logoutHandshake'
export const logoutHandshakeWait = 'config:logoutHandshakeWait'
export const mobileAppState = 'config:mobileAppState'
export const openAppSettings = 'config:openAppSettings'
export const openAppStore = 'config:openAppStore'
export const osNetworkStatusChanged = 'config:osNetworkStatusChanged'
export const persistRoute = 'config:persistRoute'
export const pushLoaded = 'config:pushLoaded'
export const restartHandshake = 'config:restartHandshake'
export const setAccounts = 'config:setAccounts'
export const setDarkModePreference = 'config:setDarkModePreference'
export const setDefaultUsername = 'config:setDefaultUsername'
export const setDeletedSelf = 'config:setDeletedSelf'
export const setNavigator = 'config:setNavigator'
export const setNotifySound = 'config:setNotifySound'
export const setOpenAtLogin = 'config:setOpenAtLogin'
export const setStartupDetails = 'config:setStartupDetails'
export const setSystemDarkMode = 'config:setSystemDarkMode'
export const showMain = 'config:showMain'
export const startHandshake = 'config:startHandshake'
export const updateCriticalCheckStatus = 'config:updateCriticalCheckStatus'
export const updateHTTPSrvInfo = 'config:updateHTTPSrvInfo'
export const updateInfo = 'config:updateInfo'
export const updateMenubarWindowID = 'config:updateMenubarWindowID'
export const updateNow = 'config:updateNow'

// Payload Types
type _BootstrapStatusLoadedPayload = {
  readonly deviceID: string
  readonly deviceName: string
  readonly fullname: string
  readonly loggedIn: boolean
  readonly registered: boolean
  readonly uid: string
  readonly username: string
  readonly userReacjis: RPCTypes.UserReacjis
}
type _ChangedActivePayload = {readonly userActive: boolean}
type _ChangedFocusPayload = {readonly appFocused: boolean}
type _CheckForUpdatePayload = void
type _CopyToClipboardPayload = {readonly text: string}
type _DaemonErrorPayload = {readonly daemonError: Error | null}
type _DaemonHandshakeDonePayload = void
type _DaemonHandshakePayload = {readonly firstTimeConnecting: boolean; readonly version: number}
type _DaemonHandshakeWaitPayload = {
  readonly name: string
  readonly version: number
  readonly increment: boolean
  readonly failedReason?: string | null
  readonly failedFatal?: true
}
type _DumpLogsPayload = {readonly reason: 'quitting through menu'}
type _FilePickerErrorPayload = {readonly error: Error}
type _FollowerInfoUpdatedPayload = {
  readonly uid: string
  readonly followers: Array<string>
  readonly followees: Array<string>
}
type _GlobalErrorPayload = {readonly globalError: null | Error | RPCError}
type _InstallerRanPayload = void
type _LoggedInPayload = {readonly causedBySignup: boolean; readonly causedByStartup: boolean}
type _LoggedOutPayload = void
type _LogoutHandshakePayload = {readonly version: number}
type _LogoutHandshakeWaitPayload = {
  readonly name: string
  readonly version: number
  readonly increment: boolean
}
type _LogoutPayload = void
type _MobileAppStatePayload = {readonly nextAppState: 'active' | 'background' | 'inactive'}
type _OpenAppSettingsPayload = void
type _OpenAppStorePayload = void
type _OsNetworkStatusChangedPayload = {
  readonly online: boolean
  readonly type: ConnectionType
  readonly isInit?: boolean
}
type _PersistRoutePayload = {readonly path: Array<any>}
type _PushLoadedPayload = {readonly pushLoaded: boolean}
type _RestartHandshakePayload = void
type _SetAccountsPayload = {readonly configuredAccounts: Array<RPCTypes.ConfiguredAccount>}
type _SetDarkModePreferencePayload = {
  readonly preference: 'system' | 'alwaysDark' | 'alwaysLight' | undefined
}
type _SetDefaultUsernamePayload = {readonly username: string}
type _SetDeletedSelfPayload = {readonly deletedUsername: string}
type _SetNavigatorPayload = {readonly navigator: any}
type _SetNotifySoundPayload = {readonly sound: boolean; readonly writeFile: boolean}
type _SetOpenAtLoginPayload = {readonly open: boolean; readonly writeFile: boolean}
type _SetStartupDetailsPayload = {
  readonly startupWasFromPush: boolean
  readonly startupConversation: ChatTypes.ConversationIDKey | null
  readonly startupLink: string
  readonly startupTab: Tabs.Tab | null
  readonly startupFollowUser: string
  readonly startupSharePath: FsTypes.LocalPath | null
}
type _SetSystemDarkModePayload = {readonly dark: boolean}
type _ShowMainPayload = void
type _StartHandshakePayload = void
type _UpdateCriticalCheckStatusPayload = {
  readonly status: 'critical' | 'suggested' | 'ok'
  readonly message: string
}
type _UpdateHTTPSrvInfoPayload = {readonly address: string; readonly token: string}
type _UpdateInfoPayload = {
  readonly isOutOfDate: boolean
  readonly critical: boolean
  readonly message?: string
}
type _UpdateMenubarWindowIDPayload = {readonly id: number}
type _UpdateNowPayload = void

// Action Creators
/**
 * Open a link to the app store
 */
export const createOpenAppStore = (payload: _OpenAppStorePayload): OpenAppStorePayload => ({
  payload,
  type: openAppStore,
})
/**
 * Save critical check status
 */
export const createUpdateCriticalCheckStatus = (
  payload: _UpdateCriticalCheckStatusPayload
): UpdateCriticalCheckStatusPayload => ({payload, type: updateCriticalCheckStatus})
/**
 * Sent whenever the mobile file picker encounters an error.
 */
export const createFilePickerError = (payload: _FilePickerErrorPayload): FilePickerErrorPayload => ({
  payload,
  type: filePickerError,
})
/**
 * Used internally to know we were logged in. if you want to react to being logged in likely you want bootstrapStatusLoaded
 */
export const createLoggedIn = (payload: _LoggedInPayload): LoggedInPayload => ({payload, type: loggedIn})
/**
 * desktop only: the installer ran and we can start up
 */
export const createInstallerRan = (payload: _InstallerRanPayload): InstallerRanPayload => ({
  payload,
  type: installerRan,
})
/**
 * internal to config. should restart the handshake process
 */
export const createRestartHandshake = (payload: _RestartHandshakePayload): RestartHandshakePayload => ({
  payload,
  type: restartHandshake,
})
/**
 * internal to config. should start the handshake process
 */
export const createStartHandshake = (payload: _StartHandshakePayload): StartHandshakePayload => ({
  payload,
  type: startHandshake,
})
/**
 * mobile only: open the settings page
 */
export const createOpenAppSettings = (payload: _OpenAppSettingsPayload): OpenAppSettingsPayload => ({
  payload,
  type: openAppSettings,
})
/**
 * ready to show the app
 */
export const createDaemonHandshakeDone = (
  payload: _DaemonHandshakeDonePayload
): DaemonHandshakeDonePayload => ({payload, type: daemonHandshakeDone})
/**
 * someone wants to log out
 */
export const createLogout = (payload: _LogoutPayload): LogoutPayload => ({payload, type: logout})
/**
 * starting the connect process. Things that need to happen before we see the app should call daemonHandshakeWait
 */
export const createDaemonHandshake = (payload: _DaemonHandshakePayload): DaemonHandshakePayload => ({
  payload,
  type: daemonHandshake,
})
/**
 * starting the logout process. Things that need to happen before we see the app should call logoutHandshakeWait
 */
export const createLogoutHandshake = (payload: _LogoutHandshakePayload): LogoutHandshakePayload => ({
  payload,
  type: logoutHandshake,
})
/**
 * subsystems that need to do things during boot need to call this to register that we should wait.
 */
export const createDaemonHandshakeWait = (
  payload: _DaemonHandshakeWaitPayload
): DaemonHandshakeWaitPayload => ({payload, type: daemonHandshakeWait})
/**
 * subsystems that need to do things during logout need to call this to register that we should wait.
 */
export const createLogoutHandshakeWait = (
  payload: _LogoutHandshakeWaitPayload
): LogoutHandshakeWaitPayload => ({payload, type: logoutHandshakeWait})
export const createBootstrapStatusLoaded = (
  payload: _BootstrapStatusLoadedPayload
): BootstrapStatusLoadedPayload => ({payload, type: bootstrapStatusLoaded})
export const createChangedActive = (payload: _ChangedActivePayload): ChangedActivePayload => ({
  payload,
  type: changedActive,
})
export const createChangedFocus = (payload: _ChangedFocusPayload): ChangedFocusPayload => ({
  payload,
  type: changedFocus,
})
export const createCheckForUpdate = (payload: _CheckForUpdatePayload): CheckForUpdatePayload => ({
  payload,
  type: checkForUpdate,
})
export const createCopyToClipboard = (payload: _CopyToClipboardPayload): CopyToClipboardPayload => ({
  payload,
  type: copyToClipboard,
})
export const createDaemonError = (payload: _DaemonErrorPayload): DaemonErrorPayload => ({
  payload,
  type: daemonError,
})
export const createDumpLogs = (payload: _DumpLogsPayload): DumpLogsPayload => ({payload, type: dumpLogs})
export const createFollowerInfoUpdated = (
  payload: _FollowerInfoUpdatedPayload
): FollowerInfoUpdatedPayload => ({payload, type: followerInfoUpdated})
export const createGlobalError = (payload: _GlobalErrorPayload): GlobalErrorPayload => ({
  payload,
  type: globalError,
})
export const createLoggedOut = (payload: _LoggedOutPayload): LoggedOutPayload => ({payload, type: loggedOut})
export const createMobileAppState = (payload: _MobileAppStatePayload): MobileAppStatePayload => ({
  payload,
  type: mobileAppState,
})
export const createOsNetworkStatusChanged = (
  payload: _OsNetworkStatusChangedPayload
): OsNetworkStatusChangedPayload => ({payload, type: osNetworkStatusChanged})
export const createPersistRoute = (payload: _PersistRoutePayload): PersistRoutePayload => ({
  payload,
  type: persistRoute,
})
export const createPushLoaded = (payload: _PushLoadedPayload): PushLoadedPayload => ({
  payload,
  type: pushLoaded,
})
export const createSetAccounts = (payload: _SetAccountsPayload): SetAccountsPayload => ({
  payload,
  type: setAccounts,
})
export const createSetDarkModePreference = (
  payload: _SetDarkModePreferencePayload
): SetDarkModePreferencePayload => ({payload, type: setDarkModePreference})
export const createSetDefaultUsername = (payload: _SetDefaultUsernamePayload): SetDefaultUsernamePayload => ({
  payload,
  type: setDefaultUsername,
})
export const createSetDeletedSelf = (payload: _SetDeletedSelfPayload): SetDeletedSelfPayload => ({
  payload,
  type: setDeletedSelf,
})
export const createSetNavigator = (payload: _SetNavigatorPayload): SetNavigatorPayload => ({
  payload,
  type: setNavigator,
})
export const createSetNotifySound = (payload: _SetNotifySoundPayload): SetNotifySoundPayload => ({
  payload,
  type: setNotifySound,
})
export const createSetOpenAtLogin = (payload: _SetOpenAtLoginPayload): SetOpenAtLoginPayload => ({
  payload,
  type: setOpenAtLogin,
})
export const createSetStartupDetails = (payload: _SetStartupDetailsPayload): SetStartupDetailsPayload => ({
  payload,
  type: setStartupDetails,
})
export const createSetSystemDarkMode = (payload: _SetSystemDarkModePayload): SetSystemDarkModePayload => ({
  payload,
  type: setSystemDarkMode,
})
export const createShowMain = (payload: _ShowMainPayload): ShowMainPayload => ({payload, type: showMain})
export const createUpdateHTTPSrvInfo = (payload: _UpdateHTTPSrvInfoPayload): UpdateHTTPSrvInfoPayload => ({
  payload,
  type: updateHTTPSrvInfo,
})
export const createUpdateInfo = (payload: _UpdateInfoPayload): UpdateInfoPayload => ({
  payload,
  type: updateInfo,
})
export const createUpdateMenubarWindowID = (
  payload: _UpdateMenubarWindowIDPayload
): UpdateMenubarWindowIDPayload => ({payload, type: updateMenubarWindowID})
export const createUpdateNow = (payload: _UpdateNowPayload): UpdateNowPayload => ({payload, type: updateNow})

// Action Payloads
export type BootstrapStatusLoadedPayload = {
  readonly payload: _BootstrapStatusLoadedPayload
  readonly type: typeof bootstrapStatusLoaded
}
export type ChangedActivePayload = {
  readonly payload: _ChangedActivePayload
  readonly type: typeof changedActive
}
export type ChangedFocusPayload = {readonly payload: _ChangedFocusPayload; readonly type: typeof changedFocus}
export type CheckForUpdatePayload = {
  readonly payload: _CheckForUpdatePayload
  readonly type: typeof checkForUpdate
}
export type CopyToClipboardPayload = {
  readonly payload: _CopyToClipboardPayload
  readonly type: typeof copyToClipboard
}
export type DaemonErrorPayload = {readonly payload: _DaemonErrorPayload; readonly type: typeof daemonError}
export type DaemonHandshakeDonePayload = {
  readonly payload: _DaemonHandshakeDonePayload
  readonly type: typeof daemonHandshakeDone
}
export type DaemonHandshakePayload = {
  readonly payload: _DaemonHandshakePayload
  readonly type: typeof daemonHandshake
}
export type DaemonHandshakeWaitPayload = {
  readonly payload: _DaemonHandshakeWaitPayload
  readonly type: typeof daemonHandshakeWait
}
export type DumpLogsPayload = {readonly payload: _DumpLogsPayload; readonly type: typeof dumpLogs}
export type FilePickerErrorPayload = {
  readonly payload: _FilePickerErrorPayload
  readonly type: typeof filePickerError
}
export type FollowerInfoUpdatedPayload = {
  readonly payload: _FollowerInfoUpdatedPayload
  readonly type: typeof followerInfoUpdated
}
export type GlobalErrorPayload = {readonly payload: _GlobalErrorPayload; readonly type: typeof globalError}
export type InstallerRanPayload = {readonly payload: _InstallerRanPayload; readonly type: typeof installerRan}
export type LoggedInPayload = {readonly payload: _LoggedInPayload; readonly type: typeof loggedIn}
export type LoggedOutPayload = {readonly payload: _LoggedOutPayload; readonly type: typeof loggedOut}
export type LogoutHandshakePayload = {
  readonly payload: _LogoutHandshakePayload
  readonly type: typeof logoutHandshake
}
export type LogoutHandshakeWaitPayload = {
  readonly payload: _LogoutHandshakeWaitPayload
  readonly type: typeof logoutHandshakeWait
}
export type LogoutPayload = {readonly payload: _LogoutPayload; readonly type: typeof logout}
export type MobileAppStatePayload = {
  readonly payload: _MobileAppStatePayload
  readonly type: typeof mobileAppState
}
export type OpenAppSettingsPayload = {
  readonly payload: _OpenAppSettingsPayload
  readonly type: typeof openAppSettings
}
export type OpenAppStorePayload = {readonly payload: _OpenAppStorePayload; readonly type: typeof openAppStore}
export type OsNetworkStatusChangedPayload = {
  readonly payload: _OsNetworkStatusChangedPayload
  readonly type: typeof osNetworkStatusChanged
}
export type PersistRoutePayload = {readonly payload: _PersistRoutePayload; readonly type: typeof persistRoute}
export type PushLoadedPayload = {readonly payload: _PushLoadedPayload; readonly type: typeof pushLoaded}
export type RestartHandshakePayload = {
  readonly payload: _RestartHandshakePayload
  readonly type: typeof restartHandshake
}
export type SetAccountsPayload = {readonly payload: _SetAccountsPayload; readonly type: typeof setAccounts}
export type SetDarkModePreferencePayload = {
  readonly payload: _SetDarkModePreferencePayload
  readonly type: typeof setDarkModePreference
}
export type SetDefaultUsernamePayload = {
  readonly payload: _SetDefaultUsernamePayload
  readonly type: typeof setDefaultUsername
}
export type SetDeletedSelfPayload = {
  readonly payload: _SetDeletedSelfPayload
  readonly type: typeof setDeletedSelf
}
export type SetNavigatorPayload = {readonly payload: _SetNavigatorPayload; readonly type: typeof setNavigator}
export type SetNotifySoundPayload = {
  readonly payload: _SetNotifySoundPayload
  readonly type: typeof setNotifySound
}
export type SetOpenAtLoginPayload = {
  readonly payload: _SetOpenAtLoginPayload
  readonly type: typeof setOpenAtLogin
}
export type SetStartupDetailsPayload = {
  readonly payload: _SetStartupDetailsPayload
  readonly type: typeof setStartupDetails
}
export type SetSystemDarkModePayload = {
  readonly payload: _SetSystemDarkModePayload
  readonly type: typeof setSystemDarkMode
}
export type ShowMainPayload = {readonly payload: _ShowMainPayload; readonly type: typeof showMain}
export type StartHandshakePayload = {
  readonly payload: _StartHandshakePayload
  readonly type: typeof startHandshake
}
export type UpdateCriticalCheckStatusPayload = {
  readonly payload: _UpdateCriticalCheckStatusPayload
  readonly type: typeof updateCriticalCheckStatus
}
export type UpdateHTTPSrvInfoPayload = {
  readonly payload: _UpdateHTTPSrvInfoPayload
  readonly type: typeof updateHTTPSrvInfo
}
export type UpdateInfoPayload = {readonly payload: _UpdateInfoPayload; readonly type: typeof updateInfo}
export type UpdateMenubarWindowIDPayload = {
  readonly payload: _UpdateMenubarWindowIDPayload
  readonly type: typeof updateMenubarWindowID
}
export type UpdateNowPayload = {readonly payload: _UpdateNowPayload; readonly type: typeof updateNow}

// All Actions
// prettier-ignore
export type Actions =
  | BootstrapStatusLoadedPayload
  | ChangedActivePayload
  | ChangedFocusPayload
  | CheckForUpdatePayload
  | CopyToClipboardPayload
  | DaemonErrorPayload
  | DaemonHandshakeDonePayload
  | DaemonHandshakePayload
  | DaemonHandshakeWaitPayload
  | DumpLogsPayload
  | FilePickerErrorPayload
  | FollowerInfoUpdatedPayload
  | GlobalErrorPayload
  | InstallerRanPayload
  | LoggedInPayload
  | LoggedOutPayload
  | LogoutHandshakePayload
  | LogoutHandshakeWaitPayload
  | LogoutPayload
  | MobileAppStatePayload
  | OpenAppSettingsPayload
  | OpenAppStorePayload
  | OsNetworkStatusChangedPayload
  | PersistRoutePayload
  | PushLoadedPayload
  | RestartHandshakePayload
  | SetAccountsPayload
  | SetDarkModePreferencePayload
  | SetDefaultUsernamePayload
  | SetDeletedSelfPayload
  | SetNavigatorPayload
  | SetNotifySoundPayload
  | SetOpenAtLoginPayload
  | SetStartupDetailsPayload
  | SetSystemDarkModePayload
  | ShowMainPayload
  | StartHandshakePayload
  | UpdateCriticalCheckStatusPayload
  | UpdateHTTPSrvInfoPayload
  | UpdateInfoPayload
  | UpdateMenubarWindowIDPayload
  | UpdateNowPayload
  | {type: 'common:resetStore', payload: {}}
