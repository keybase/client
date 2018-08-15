// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/config'
import * as Tabs from '../constants/tabs'
import * as ChatTypes from '../constants/types/chat2'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of config but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'config:'
export const bootstrapStatusLoaded = typePrefix + 'bootstrapStatusLoaded'
export const changedActive = typePrefix + 'changedActive'
export const changedFocus = typePrefix + 'changedFocus'
export const daemonError = typePrefix + 'daemonError'
export const daemonHandshake = typePrefix + 'daemonHandshake'
export const daemonHandshakeDone = typePrefix + 'daemonHandshakeDone'
export const daemonHandshakeWait = typePrefix + 'daemonHandshakeWait'
export const debugDump = typePrefix + 'debugDump'
export const dumpLogs = typePrefix + 'dumpLogs'
export const globalError = typePrefix + 'globalError'
export const installerRan = typePrefix + 'installerRan'
export const link = typePrefix + 'link'
export const loadAvatars = typePrefix + 'loadAvatars'
export const loadTeamAvatars = typePrefix + 'loadTeamAvatars'
export const loadedAvatars = typePrefix + 'loadedAvatars'
export const loggedIn = typePrefix + 'loggedIn'
export const loggedOut = typePrefix + 'loggedOut'
export const logout = typePrefix + 'logout'
export const logoutHandshake = typePrefix + 'logoutHandshake'
export const logoutHandshakeWait = typePrefix + 'logoutHandshakeWait'
export const mobileAppState = typePrefix + 'mobileAppState'
export const openAppSettings = typePrefix + 'openAppSettings'
export const pushLoaded = typePrefix + 'pushLoaded'
export const restartHandshake = typePrefix + 'restartHandshake'
export const setAccounts = typePrefix + 'setAccounts'
export const setDeletedSelf = typePrefix + 'setDeletedSelf'
export const setNotifySound = typePrefix + 'setNotifySound'
export const setOpenAtLogin = typePrefix + 'setOpenAtLogin'
export const setStartupDetails = typePrefix + 'setStartupDetails'
export const setupEngineListeners = typePrefix + 'setupEngineListeners'
export const showMain = typePrefix + 'showMain'
export const startHandshake = typePrefix + 'startHandshake'
export const updateFollowing = typePrefix + 'updateFollowing'

// Payload Types
type _BootstrapStatusLoadedPayload = $ReadOnly<{|
  deviceID: string,
  deviceName: string,
  followers: Array<string>,
  following: Array<string>,
  loggedIn: boolean,
  registered: boolean,
  uid: string,
  username: string,
|}>
type _ChangedActivePayload = $ReadOnly<{|userActive: boolean|}>
type _ChangedFocusPayload = $ReadOnly<{|appFocused: boolean|}>
type _DaemonErrorPayload = $ReadOnly<{|daemonError: ?Error|}>
type _DaemonHandshakeDonePayload = void
type _DaemonHandshakePayload = $ReadOnly<{|firstTimeConnecting: boolean|}>
type _DaemonHandshakeWaitPayload = $ReadOnly<{|
  name: string,
  increment: boolean,
  failedReason?: ?string,
  failedFatal?: true,
|}>
type _DebugDumpPayload = $ReadOnly<{|items: Array<string>|}>
type _DumpLogsPayload = $ReadOnly<{|reason: 'quitting through menu'|}>
type _GlobalErrorPayload = $ReadOnly<{|globalError: null | Error | RPCError|}>
type _InstallerRanPayload = void
type _LinkPayload = $ReadOnly<{|link: string|}>
type _LoadAvatarsPayload = $ReadOnly<{|usernames: Array<string>|}>
type _LoadTeamAvatarsPayload = $ReadOnly<{|teamnames: Array<string>|}>
type _LoadedAvatarsPayload = $ReadOnly<{|nameToUrlMap: {[name: string]: ?Object}|}>
type _LoggedInPayload = $ReadOnly<{|causedByStartup: boolean|}>
type _LoggedOutPayload = void
type _LogoutHandshakePayload = void
type _LogoutHandshakeWaitPayload = $ReadOnly<{|
  name: string,
  increment: boolean,
|}>
type _LogoutPayload = void
type _MobileAppStatePayload = $ReadOnly<{|nextAppState: 'active' | 'background' | 'inactive'|}>
type _OpenAppSettingsPayload = void
type _PushLoadedPayload = $ReadOnly<{|pushLoaded: boolean|}>
type _RestartHandshakePayload = void
type _SetAccountsPayload = $ReadOnly<{|
  defaultUsername: string,
  usernames: Array<string>,
|}>
type _SetDeletedSelfPayload = $ReadOnly<{|deletedUsername: string|}>
type _SetNotifySoundPayload = $ReadOnly<{|
  sound: boolean,
  writeFile: boolean,
|}>
type _SetOpenAtLoginPayload = $ReadOnly<{|
  open: boolean,
  writeFile: boolean,
|}>
type _SetStartupDetailsPayload = $ReadOnly<{|
  startupWasFromPush: boolean,
  startupConversation: ?ChatTypes.ConversationIDKey,
  startupLink: string,
  startupTab: ?Tabs.Tab,
  startupFollowUser: string,
|}>
type _SetupEngineListenersPayload = void
type _ShowMainPayload = void
type _StartHandshakePayload = void
type _UpdateFollowingPayload = $ReadOnly<{|
  username: string,
  isTracking: boolean,
|}>

// Action Creators
/**
 * desktop only: the installer ran and we can start up
 */
export const createInstallerRan = (payload: _InstallerRanPayload) => ({error: false, payload, type: installerRan})
/**
 * internal to config. should restart the handshake process
 */
export const createRestartHandshake = (payload: _RestartHandshakePayload) => ({error: false, payload, type: restartHandshake})
/**
 * internal to config. should start the handshake process
 */
export const createStartHandshake = (payload: _StartHandshakePayload) => ({error: false, payload, type: startHandshake})
/**
 * mobile only: open the settings page
 */
export const createOpenAppSettings = (payload: _OpenAppSettingsPayload) => ({error: false, payload, type: openAppSettings})
/**
 * ready to show the app
 */
export const createDaemonHandshakeDone = (payload: _DaemonHandshakeDonePayload) => ({error: false, payload, type: daemonHandshakeDone})
/**
 * someone wants to log out
 */
export const createLogout = (payload: _LogoutPayload) => ({error: false, payload, type: logout})
/**
 * starting the connect process. Things that need to happen before we see the app should call daemonHandshakeWait
 */
export const createDaemonHandshake = (payload: _DaemonHandshakePayload) => ({error: false, payload, type: daemonHandshake})
/**
 * starting the logout process. Things that need to happen before we see the app should call logoutHandshakeWait
 */
export const createLogoutHandshake = (payload: _LogoutHandshakePayload) => ({error: false, payload, type: logoutHandshake})
/**
 * subsystems that need to do things during boot need to call this to register that we should wait.
 */
export const createDaemonHandshakeWait = (payload: _DaemonHandshakeWaitPayload) => ({error: false, payload, type: daemonHandshakeWait})
/**
 * subsystems that need to do things during logout need to call this to register that we should wait.
 */
export const createLogoutHandshakeWait = (payload: _LogoutHandshakeWaitPayload) => ({error: false, payload, type: logoutHandshakeWait})
/**
 * when sagas should start creating their incoming handlers / onConnect handlers
 */
export const createSetupEngineListeners = (payload: _SetupEngineListenersPayload) => ({error: false, payload, type: setupEngineListeners})
export const createBootstrapStatusLoaded = (payload: _BootstrapStatusLoadedPayload) => ({error: false, payload, type: bootstrapStatusLoaded})
export const createChangedActive = (payload: _ChangedActivePayload) => ({error: false, payload, type: changedActive})
export const createChangedFocus = (payload: _ChangedFocusPayload) => ({error: false, payload, type: changedFocus})
export const createDaemonError = (payload: _DaemonErrorPayload) => ({error: false, payload, type: daemonError})
export const createDebugDump = (payload: _DebugDumpPayload) => ({error: false, payload, type: debugDump})
export const createDumpLogs = (payload: _DumpLogsPayload) => ({error: false, payload, type: dumpLogs})
export const createGlobalError = (payload: _GlobalErrorPayload) => ({error: false, payload, type: globalError})
export const createLink = (payload: _LinkPayload) => ({error: false, payload, type: link})
export const createLoadAvatars = (payload: _LoadAvatarsPayload) => ({error: false, payload, type: loadAvatars})
export const createLoadTeamAvatars = (payload: _LoadTeamAvatarsPayload) => ({error: false, payload, type: loadTeamAvatars})
export const createLoadedAvatars = (payload: _LoadedAvatarsPayload) => ({error: false, payload, type: loadedAvatars})
export const createLoggedIn = (payload: _LoggedInPayload) => ({error: false, payload, type: loggedIn})
export const createLoggedOut = (payload: _LoggedOutPayload) => ({error: false, payload, type: loggedOut})
export const createMobileAppState = (payload: _MobileAppStatePayload) => ({error: false, payload, type: mobileAppState})
export const createPushLoaded = (payload: _PushLoadedPayload) => ({error: false, payload, type: pushLoaded})
export const createSetAccounts = (payload: _SetAccountsPayload) => ({error: false, payload, type: setAccounts})
export const createSetDeletedSelf = (payload: _SetDeletedSelfPayload) => ({error: false, payload, type: setDeletedSelf})
export const createSetNotifySound = (payload: _SetNotifySoundPayload) => ({error: false, payload, type: setNotifySound})
export const createSetOpenAtLogin = (payload: _SetOpenAtLoginPayload) => ({error: false, payload, type: setOpenAtLogin})
export const createSetStartupDetails = (payload: _SetStartupDetailsPayload) => ({error: false, payload, type: setStartupDetails})
export const createShowMain = (payload: _ShowMainPayload) => ({error: false, payload, type: showMain})
export const createUpdateFollowing = (payload: _UpdateFollowingPayload) => ({error: false, payload, type: updateFollowing})

// Action Payloads
export type BootstrapStatusLoadedPayload = $Call<typeof createBootstrapStatusLoaded, _BootstrapStatusLoadedPayload>
export type ChangedActivePayload = $Call<typeof createChangedActive, _ChangedActivePayload>
export type ChangedFocusPayload = $Call<typeof createChangedFocus, _ChangedFocusPayload>
export type DaemonErrorPayload = $Call<typeof createDaemonError, _DaemonErrorPayload>
export type DaemonHandshakeDonePayload = $Call<typeof createDaemonHandshakeDone, _DaemonHandshakeDonePayload>
export type DaemonHandshakePayload = $Call<typeof createDaemonHandshake, _DaemonHandshakePayload>
export type DaemonHandshakeWaitPayload = $Call<typeof createDaemonHandshakeWait, _DaemonHandshakeWaitPayload>
export type DebugDumpPayload = $Call<typeof createDebugDump, _DebugDumpPayload>
export type DumpLogsPayload = $Call<typeof createDumpLogs, _DumpLogsPayload>
export type GlobalErrorPayload = $Call<typeof createGlobalError, _GlobalErrorPayload>
export type InstallerRanPayload = $Call<typeof createInstallerRan, _InstallerRanPayload>
export type LinkPayload = $Call<typeof createLink, _LinkPayload>
export type LoadAvatarsPayload = $Call<typeof createLoadAvatars, _LoadAvatarsPayload>
export type LoadTeamAvatarsPayload = $Call<typeof createLoadTeamAvatars, _LoadTeamAvatarsPayload>
export type LoadedAvatarsPayload = $Call<typeof createLoadedAvatars, _LoadedAvatarsPayload>
export type LoggedInPayload = $Call<typeof createLoggedIn, _LoggedInPayload>
export type LoggedOutPayload = $Call<typeof createLoggedOut, _LoggedOutPayload>
export type LogoutHandshakePayload = $Call<typeof createLogoutHandshake, _LogoutHandshakePayload>
export type LogoutHandshakeWaitPayload = $Call<typeof createLogoutHandshakeWait, _LogoutHandshakeWaitPayload>
export type LogoutPayload = $Call<typeof createLogout, _LogoutPayload>
export type MobileAppStatePayload = $Call<typeof createMobileAppState, _MobileAppStatePayload>
export type OpenAppSettingsPayload = $Call<typeof createOpenAppSettings, _OpenAppSettingsPayload>
export type PushLoadedPayload = $Call<typeof createPushLoaded, _PushLoadedPayload>
export type RestartHandshakePayload = $Call<typeof createRestartHandshake, _RestartHandshakePayload>
export type SetAccountsPayload = $Call<typeof createSetAccounts, _SetAccountsPayload>
export type SetDeletedSelfPayload = $Call<typeof createSetDeletedSelf, _SetDeletedSelfPayload>
export type SetNotifySoundPayload = $Call<typeof createSetNotifySound, _SetNotifySoundPayload>
export type SetOpenAtLoginPayload = $Call<typeof createSetOpenAtLogin, _SetOpenAtLoginPayload>
export type SetStartupDetailsPayload = $Call<typeof createSetStartupDetails, _SetStartupDetailsPayload>
export type SetupEngineListenersPayload = $Call<typeof createSetupEngineListeners, _SetupEngineListenersPayload>
export type ShowMainPayload = $Call<typeof createShowMain, _ShowMainPayload>
export type StartHandshakePayload = $Call<typeof createStartHandshake, _StartHandshakePayload>
export type UpdateFollowingPayload = $Call<typeof createUpdateFollowing, _UpdateFollowingPayload>

// All Actions
// prettier-ignore
export type Actions =
  | BootstrapStatusLoadedPayload
  | ChangedActivePayload
  | ChangedFocusPayload
  | DaemonErrorPayload
  | DaemonHandshakeDonePayload
  | DaemonHandshakePayload
  | DaemonHandshakeWaitPayload
  | DebugDumpPayload
  | DumpLogsPayload
  | GlobalErrorPayload
  | InstallerRanPayload
  | LinkPayload
  | LoadAvatarsPayload
  | LoadTeamAvatarsPayload
  | LoadedAvatarsPayload
  | LoggedInPayload
  | LoggedOutPayload
  | LogoutHandshakePayload
  | LogoutHandshakeWaitPayload
  | LogoutPayload
  | MobileAppStatePayload
  | OpenAppSettingsPayload
  | PushLoadedPayload
  | RestartHandshakePayload
  | SetAccountsPayload
  | SetDeletedSelfPayload
  | SetNotifySoundPayload
  | SetOpenAtLoginPayload
  | SetStartupDetailsPayload
  | SetupEngineListenersPayload
  | ShowMainPayload
  | StartHandshakePayload
  | UpdateFollowingPayload
  | {type: 'common:resetStore', payload: void}
