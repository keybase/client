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
export const _avatarQueue = 'config:_avatarQueue'
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
export const globalError = 'config:globalError'
export const installerRan = 'config:installerRan'
export const link = 'config:link'
export const loadAvatars = 'config:loadAvatars'
export const loadTeamAvatars = 'config:loadTeamAvatars'
export const loadedAvatars = 'config:loadedAvatars'
export const loggedIn = 'config:loggedIn'
export const loggedOut = 'config:loggedOut'
export const logout = 'config:logout'
export const logoutHandshake = 'config:logoutHandshake'
export const logoutHandshakeWait = 'config:logoutHandshakeWait'
export const mobileAppState = 'config:mobileAppState'
export const openAppSettings = 'config:openAppSettings'
export const pushLoaded = 'config:pushLoaded'
export const restartHandshake = 'config:restartHandshake'
export const setAccounts = 'config:setAccounts'
export const setDeletedSelf = 'config:setDeletedSelf'
export const setNotifySound = 'config:setNotifySound'
export const setOpenAtLogin = 'config:setOpenAtLogin'
export const setStartupDetails = 'config:setStartupDetails'
export const setupEngineListeners = 'config:setupEngineListeners'
export const showMain = 'config:showMain'
export const startHandshake = 'config:startHandshake'
export const updateFollowing = 'config:updateFollowing'
export const updateInfo = 'config:updateInfo'
export const updateMenubarWindowID = 'config:updateMenubarWindowID'
export const updateNow = 'config:updateNow'

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
type _CheckForUpdatePayload = void
type _CopyToClipboardPayload = $ReadOnly<{|text: string|}>
type _DaemonErrorPayload = $ReadOnly<{|daemonError: ?Error|}>
type _DaemonHandshakeDonePayload = void
type _DaemonHandshakePayload = $ReadOnly<{|
  firstTimeConnecting: boolean,
  version: number,
|}>
type _DaemonHandshakeWaitPayload = $ReadOnly<{|
  name: string,
  version: number,
  increment: boolean,
  failedReason?: ?string,
  failedFatal?: true,
|}>
type _DumpLogsPayload = $ReadOnly<{|reason: 'quitting through menu'|}>
type _GlobalErrorPayload = $ReadOnly<{|globalError: null | Error | RPCError|}>
type _InstallerRanPayload = void
type _LinkPayload = $ReadOnly<{|link: string|}>
type _LoadAvatarsPayload = $ReadOnly<{|usernames: Array<string>|}>
type _LoadTeamAvatarsPayload = $ReadOnly<{|teamnames: Array<string>|}>
type _LoadedAvatarsPayload = $ReadOnly<{|avatars: I.Map<string, I.Map<number, string>>|}>
type _LoggedInPayload = $ReadOnly<{|causedByStartup: boolean|}>
type _LoggedOutPayload = void
type _LogoutHandshakePayload = $ReadOnly<{|version: number|}>
type _LogoutHandshakeWaitPayload = $ReadOnly<{|
  name: string,
  version: number,
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
type _UpdateInfoPayload = $ReadOnly<{|
  isOutOfDate: boolean,
  critical: boolean,
  message?: string,
|}>
type _UpdateMenubarWindowIDPayload = $ReadOnly<{|id: number|}>
type _UpdateNowPayload = void
type __avatarQueuePayload = void

// Action Creators
/**
 * desktop only: the installer ran and we can start up
 */
export const createInstallerRan = (payload: _InstallerRanPayload) => ({payload, type: installerRan})
/**
 * internal to config. should restart the handshake process
 */
export const createRestartHandshake = (payload: _RestartHandshakePayload) => ({payload, type: restartHandshake})
/**
 * internal to config. should start the handshake process
 */
export const createStartHandshake = (payload: _StartHandshakePayload) => ({payload, type: startHandshake})
/**
 * mobile only: open the settings page
 */
export const createOpenAppSettings = (payload: _OpenAppSettingsPayload) => ({payload, type: openAppSettings})
/**
 * ready to show the app
 */
export const createDaemonHandshakeDone = (payload: _DaemonHandshakeDonePayload) => ({payload, type: daemonHandshakeDone})
/**
 * someone wants to log out
 */
export const createLogout = (payload: _LogoutPayload) => ({payload, type: logout})
/**
 * starting the connect process. Things that need to happen before we see the app should call daemonHandshakeWait
 */
export const createDaemonHandshake = (payload: _DaemonHandshakePayload) => ({payload, type: daemonHandshake})
/**
 * starting the logout process. Things that need to happen before we see the app should call logoutHandshakeWait
 */
export const createLogoutHandshake = (payload: _LogoutHandshakePayload) => ({payload, type: logoutHandshake})
/**
 * subsystems that need to do things during boot need to call this to register that we should wait.
 */
export const createDaemonHandshakeWait = (payload: _DaemonHandshakeWaitPayload) => ({payload, type: daemonHandshakeWait})
/**
 * subsystems that need to do things during logout need to call this to register that we should wait.
 */
export const createLogoutHandshakeWait = (payload: _LogoutHandshakeWaitPayload) => ({payload, type: logoutHandshakeWait})
/**
 * when sagas should start creating their incoming handlers / onConnect handlers
 */
export const createSetupEngineListeners = (payload: _SetupEngineListenersPayload) => ({payload, type: setupEngineListeners})
export const createBootstrapStatusLoaded = (payload: _BootstrapStatusLoadedPayload) => ({payload, type: bootstrapStatusLoaded})
export const createChangedActive = (payload: _ChangedActivePayload) => ({payload, type: changedActive})
export const createChangedFocus = (payload: _ChangedFocusPayload) => ({payload, type: changedFocus})
export const createCheckForUpdate = (payload: _CheckForUpdatePayload) => ({payload, type: checkForUpdate})
export const createCopyToClipboard = (payload: _CopyToClipboardPayload) => ({payload, type: copyToClipboard})
export const createDaemonError = (payload: _DaemonErrorPayload) => ({payload, type: daemonError})
export const createDumpLogs = (payload: _DumpLogsPayload) => ({payload, type: dumpLogs})
export const createGlobalError = (payload: _GlobalErrorPayload) => ({payload, type: globalError})
export const createLink = (payload: _LinkPayload) => ({payload, type: link})
export const createLoadAvatars = (payload: _LoadAvatarsPayload) => ({payload, type: loadAvatars})
export const createLoadTeamAvatars = (payload: _LoadTeamAvatarsPayload) => ({payload, type: loadTeamAvatars})
export const createLoadedAvatars = (payload: _LoadedAvatarsPayload) => ({payload, type: loadedAvatars})
export const createLoggedIn = (payload: _LoggedInPayload) => ({payload, type: loggedIn})
export const createLoggedOut = (payload: _LoggedOutPayload) => ({payload, type: loggedOut})
export const createMobileAppState = (payload: _MobileAppStatePayload) => ({payload, type: mobileAppState})
export const createPushLoaded = (payload: _PushLoadedPayload) => ({payload, type: pushLoaded})
export const createSetAccounts = (payload: _SetAccountsPayload) => ({payload, type: setAccounts})
export const createSetDeletedSelf = (payload: _SetDeletedSelfPayload) => ({payload, type: setDeletedSelf})
export const createSetNotifySound = (payload: _SetNotifySoundPayload) => ({payload, type: setNotifySound})
export const createSetOpenAtLogin = (payload: _SetOpenAtLoginPayload) => ({payload, type: setOpenAtLogin})
export const createSetStartupDetails = (payload: _SetStartupDetailsPayload) => ({payload, type: setStartupDetails})
export const createShowMain = (payload: _ShowMainPayload) => ({payload, type: showMain})
export const createUpdateFollowing = (payload: _UpdateFollowingPayload) => ({payload, type: updateFollowing})
export const createUpdateInfo = (payload: _UpdateInfoPayload) => ({payload, type: updateInfo})
export const createUpdateMenubarWindowID = (payload: _UpdateMenubarWindowIDPayload) => ({payload, type: updateMenubarWindowID})
export const createUpdateNow = (payload: _UpdateNowPayload) => ({payload, type: updateNow})
export const create_avatarQueue = (payload: __avatarQueuePayload) => ({payload, type: _avatarQueue})

// Action Payloads
export type BootstrapStatusLoadedPayload = $Call<typeof createBootstrapStatusLoaded, _BootstrapStatusLoadedPayload>
export type ChangedActivePayload = $Call<typeof createChangedActive, _ChangedActivePayload>
export type ChangedFocusPayload = $Call<typeof createChangedFocus, _ChangedFocusPayload>
export type CheckForUpdatePayload = $Call<typeof createCheckForUpdate, _CheckForUpdatePayload>
export type CopyToClipboardPayload = $Call<typeof createCopyToClipboard, _CopyToClipboardPayload>
export type DaemonErrorPayload = $Call<typeof createDaemonError, _DaemonErrorPayload>
export type DaemonHandshakeDonePayload = $Call<typeof createDaemonHandshakeDone, _DaemonHandshakeDonePayload>
export type DaemonHandshakePayload = $Call<typeof createDaemonHandshake, _DaemonHandshakePayload>
export type DaemonHandshakeWaitPayload = $Call<typeof createDaemonHandshakeWait, _DaemonHandshakeWaitPayload>
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
export type UpdateInfoPayload = $Call<typeof createUpdateInfo, _UpdateInfoPayload>
export type UpdateMenubarWindowIDPayload = $Call<typeof createUpdateMenubarWindowID, _UpdateMenubarWindowIDPayload>
export type UpdateNowPayload = $Call<typeof createUpdateNow, _UpdateNowPayload>
export type _avatarQueuePayload = $Call<typeof create_avatarQueue, __avatarQueuePayload>

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
  | UpdateInfoPayload
  | UpdateMenubarWindowIDPayload
  | UpdateNowPayload
  | _avatarQueuePayload
  | {type: 'common:resetStore', payload: void}
