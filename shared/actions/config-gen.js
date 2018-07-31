// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/config'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of config but is handled by every reducer
export const bootstrapStatusLoaded = 'config:bootstrapStatusLoaded'
export const changeKBFSPath = 'config:changeKBFSPath'
export const changedActive = 'config:changedActive'
export const changedFocus = 'config:changedFocus'
export const clearRouteState = 'config:clearRouteState'
export const configLoaded = 'config:configLoaded'
export const configuredAccounts = 'config:configuredAccounts'
export const daemonError = 'config:daemonError'
export const daemonHandshake = 'config:daemonHandshake'
export const daemonHandshakeDone = 'config:daemonHandshakeDone'
export const daemonHandshakeWait = 'config:daemonHandshakeWait'
export const debugDump = 'config:debugDump'
export const dumpLogs = 'config:dumpLogs'
export const extendedConfigLoaded = 'config:extendedConfigLoaded'
export const getExtendedStatus = 'config:getExtendedStatus'
export const globalError = 'config:globalError'
export const installerRan = 'config:installerRan'
export const link = 'config:link'
export const loadAvatars = 'config:loadAvatars'
export const loadTeamAvatars = 'config:loadTeamAvatars'
export const loadedAvatars = 'config:loadedAvatars'
export const mobileAppState = 'config:mobileAppState'
export const openAppSettings = 'config:openAppSettings'
export const persistRouteState = 'config:persistRouteState'
export const pushLoaded = 'config:pushLoaded'
export const registerIncomingHandlers = 'config:registerIncomingHandlers'
export const setInitialState = 'config:setInitialState'
export const setNotifySound = 'config:setNotifySound'
export const setOpenAtLogin = 'config:setOpenAtLogin'
export const setStartedDueToPush = 'config:setStartedDueToPush'
export const setupEngineListeners = 'config:setupEngineListeners'
export const showMain = 'config:showMain'
export const startHandshake = 'config:startHandshake'
export const updateFollowing = 'config:updateFollowing'

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
type _ChangeKBFSPathPayload = $ReadOnly<{|kbfsPath: string|}>
type _ChangedActivePayload = $ReadOnly<{|userActive: boolean|}>
type _ChangedFocusPayload = $ReadOnly<{|appFocused: boolean|}>
type _ClearRouteStatePayload = void
type _ConfigLoadedPayload = $ReadOnly<{|
  version: string,
  versionShort: string,
|}>
type _ConfiguredAccountsPayload = $ReadOnly<{|accounts: Array<string>|}>
type _DaemonErrorPayload = $ReadOnly<{|daemonError: ?Error|}>
type _DaemonHandshakeDonePayload = void
type _DaemonHandshakePayload = $ReadOnly<{|firstTimeConnecting: boolean|}>
type _DaemonHandshakeWaitPayload = $ReadOnly<{|
  name: string,
  increment: boolean,
  failedReason?: ?string,
|}>
type _DebugDumpPayload = $ReadOnly<{|items: Array<string>|}>
type _DumpLogsPayload = $ReadOnly<{|reason: 'quitting through menu'|}>
type _ExtendedConfigLoadedPayload = $ReadOnly<{|extendedConfig: RPCTypes.ExtendedStatus|}>
type _GetExtendedStatusPayload = void
type _GlobalErrorPayload = $ReadOnly<{|globalError: null | Error | RPCError|}>
type _InstallerRanPayload = void
type _LinkPayload = $ReadOnly<{|link: string|}>
type _LoadAvatarsPayload = $ReadOnly<{|usernames: Array<string>|}>
type _LoadTeamAvatarsPayload = $ReadOnly<{|teamnames: Array<string>|}>
type _LoadedAvatarsPayload = $ReadOnly<{|nameToUrlMap: {[name: string]: ?Object}|}>
type _MobileAppStatePayload = $ReadOnly<{|nextAppState: 'active' | 'background' | 'inactive'|}>
type _OpenAppSettingsPayload = void
type _PersistRouteStatePayload = void
type _PushLoadedPayload = $ReadOnly<{|pushLoaded: boolean|}>
type _RegisterIncomingHandlersPayload = void
type _SetInitialStatePayload = $ReadOnly<{|initialState: ?Types.InitialState|}>
type _SetNotifySoundPayload = $ReadOnly<{|
  sound: boolean,
  writeFile: boolean,
|}>
type _SetOpenAtLoginPayload = $ReadOnly<{|
  open: boolean,
  writeFile: boolean,
|}>
type _SetStartedDueToPushPayload = void
type _SetupEngineListenersPayload = void
type _ShowMainPayload = void
type _StartHandshakePayload = void
type _UpdateFollowingPayload = $ReadOnly<{|
  username: string,
  isTracking: boolean,
|}>

// Action Creators
/**
 * All sagas should register their incoming handlers now
 */
export const createRegisterIncomingHandlers = (payload: _RegisterIncomingHandlersPayload) => ({error: false, payload, type: registerIncomingHandlers})
/**
 * desktop only: the installer ran and we can start up
 */
export const createInstallerRan = (payload: _InstallerRanPayload) => ({error: false, payload, type: installerRan})
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
 * starting the connect process. Things that need to happen before we see the app should call daemonHandshakeWait
 */
export const createDaemonHandshake = (payload: _DaemonHandshakePayload) => ({error: false, payload, type: daemonHandshake})
/**
 * subsystems that need to do things during boot need to call this to register that we should wait.
 */
export const createDaemonHandshakeWait = (payload: _DaemonHandshakeWaitPayload) => ({error: false, payload, type: daemonHandshakeWait})
/**
 * when sagas should start creating their incoming handlers / onConnect handlers
 */
export const createSetupEngineListeners = (payload: _SetupEngineListenersPayload) => ({error: false, payload, type: setupEngineListeners})
export const createBootstrapStatusLoaded = (payload: _BootstrapStatusLoadedPayload) => ({error: false, payload, type: bootstrapStatusLoaded})
export const createChangeKBFSPath = (payload: _ChangeKBFSPathPayload) => ({error: false, payload, type: changeKBFSPath})
export const createChangedActive = (payload: _ChangedActivePayload) => ({error: false, payload, type: changedActive})
export const createChangedFocus = (payload: _ChangedFocusPayload) => ({error: false, payload, type: changedFocus})
export const createClearRouteState = (payload: _ClearRouteStatePayload) => ({error: false, payload, type: clearRouteState})
export const createConfigLoaded = (payload: _ConfigLoadedPayload) => ({error: false, payload, type: configLoaded})
export const createConfiguredAccounts = (payload: _ConfiguredAccountsPayload) => ({error: false, payload, type: configuredAccounts})
export const createDaemonError = (payload: _DaemonErrorPayload) => ({error: false, payload, type: daemonError})
export const createDebugDump = (payload: _DebugDumpPayload) => ({error: false, payload, type: debugDump})
export const createDumpLogs = (payload: _DumpLogsPayload) => ({error: false, payload, type: dumpLogs})
export const createExtendedConfigLoaded = (payload: _ExtendedConfigLoadedPayload) => ({error: false, payload, type: extendedConfigLoaded})
export const createGetExtendedStatus = (payload: _GetExtendedStatusPayload) => ({error: false, payload, type: getExtendedStatus})
export const createGlobalError = (payload: _GlobalErrorPayload) => ({error: false, payload, type: globalError})
export const createLink = (payload: _LinkPayload) => ({error: false, payload, type: link})
export const createLoadAvatars = (payload: _LoadAvatarsPayload) => ({error: false, payload, type: loadAvatars})
export const createLoadTeamAvatars = (payload: _LoadTeamAvatarsPayload) => ({error: false, payload, type: loadTeamAvatars})
export const createLoadedAvatars = (payload: _LoadedAvatarsPayload) => ({error: false, payload, type: loadedAvatars})
export const createMobileAppState = (payload: _MobileAppStatePayload) => ({error: false, payload, type: mobileAppState})
export const createPersistRouteState = (payload: _PersistRouteStatePayload) => ({error: false, payload, type: persistRouteState})
export const createPushLoaded = (payload: _PushLoadedPayload) => ({error: false, payload, type: pushLoaded})
export const createSetInitialState = (payload: _SetInitialStatePayload) => ({error: false, payload, type: setInitialState})
export const createSetNotifySound = (payload: _SetNotifySoundPayload) => ({error: false, payload, type: setNotifySound})
export const createSetOpenAtLogin = (payload: _SetOpenAtLoginPayload) => ({error: false, payload, type: setOpenAtLogin})
export const createSetStartedDueToPush = (payload: _SetStartedDueToPushPayload) => ({error: false, payload, type: setStartedDueToPush})
export const createShowMain = (payload: _ShowMainPayload) => ({error: false, payload, type: showMain})
export const createUpdateFollowing = (payload: _UpdateFollowingPayload) => ({error: false, payload, type: updateFollowing})

// Action Payloads
export type BootstrapStatusLoadedPayload = $Call<typeof createBootstrapStatusLoaded, _BootstrapStatusLoadedPayload>
export type ChangeKBFSPathPayload = $Call<typeof createChangeKBFSPath, _ChangeKBFSPathPayload>
export type ChangedActivePayload = $Call<typeof createChangedActive, _ChangedActivePayload>
export type ChangedFocusPayload = $Call<typeof createChangedFocus, _ChangedFocusPayload>
export type ClearRouteStatePayload = $Call<typeof createClearRouteState, _ClearRouteStatePayload>
export type ConfigLoadedPayload = $Call<typeof createConfigLoaded, _ConfigLoadedPayload>
export type ConfiguredAccountsPayload = $Call<typeof createConfiguredAccounts, _ConfiguredAccountsPayload>
export type DaemonErrorPayload = $Call<typeof createDaemonError, _DaemonErrorPayload>
export type DaemonHandshakeDonePayload = $Call<typeof createDaemonHandshakeDone, _DaemonHandshakeDonePayload>
export type DaemonHandshakePayload = $Call<typeof createDaemonHandshake, _DaemonHandshakePayload>
export type DaemonHandshakeWaitPayload = $Call<typeof createDaemonHandshakeWait, _DaemonHandshakeWaitPayload>
export type DebugDumpPayload = $Call<typeof createDebugDump, _DebugDumpPayload>
export type DumpLogsPayload = $Call<typeof createDumpLogs, _DumpLogsPayload>
export type ExtendedConfigLoadedPayload = $Call<typeof createExtendedConfigLoaded, _ExtendedConfigLoadedPayload>
export type GetExtendedStatusPayload = $Call<typeof createGetExtendedStatus, _GetExtendedStatusPayload>
export type GlobalErrorPayload = $Call<typeof createGlobalError, _GlobalErrorPayload>
export type InstallerRanPayload = $Call<typeof createInstallerRan, _InstallerRanPayload>
export type LinkPayload = $Call<typeof createLink, _LinkPayload>
export type LoadAvatarsPayload = $Call<typeof createLoadAvatars, _LoadAvatarsPayload>
export type LoadTeamAvatarsPayload = $Call<typeof createLoadTeamAvatars, _LoadTeamAvatarsPayload>
export type LoadedAvatarsPayload = $Call<typeof createLoadedAvatars, _LoadedAvatarsPayload>
export type MobileAppStatePayload = $Call<typeof createMobileAppState, _MobileAppStatePayload>
export type OpenAppSettingsPayload = $Call<typeof createOpenAppSettings, _OpenAppSettingsPayload>
export type PersistRouteStatePayload = $Call<typeof createPersistRouteState, _PersistRouteStatePayload>
export type PushLoadedPayload = $Call<typeof createPushLoaded, _PushLoadedPayload>
export type RegisterIncomingHandlersPayload = $Call<typeof createRegisterIncomingHandlers, _RegisterIncomingHandlersPayload>
export type SetInitialStatePayload = $Call<typeof createSetInitialState, _SetInitialStatePayload>
export type SetNotifySoundPayload = $Call<typeof createSetNotifySound, _SetNotifySoundPayload>
export type SetOpenAtLoginPayload = $Call<typeof createSetOpenAtLogin, _SetOpenAtLoginPayload>
export type SetStartedDueToPushPayload = $Call<typeof createSetStartedDueToPush, _SetStartedDueToPushPayload>
export type SetupEngineListenersPayload = $Call<typeof createSetupEngineListeners, _SetupEngineListenersPayload>
export type ShowMainPayload = $Call<typeof createShowMain, _ShowMainPayload>
export type StartHandshakePayload = $Call<typeof createStartHandshake, _StartHandshakePayload>
export type UpdateFollowingPayload = $Call<typeof createUpdateFollowing, _UpdateFollowingPayload>

// All Actions
// prettier-ignore
export type Actions =
  | BootstrapStatusLoadedPayload
  | ChangeKBFSPathPayload
  | ChangedActivePayload
  | ChangedFocusPayload
  | ClearRouteStatePayload
  | ConfigLoadedPayload
  | ConfiguredAccountsPayload
  | DaemonErrorPayload
  | DaemonHandshakeDonePayload
  | DaemonHandshakePayload
  | DaemonHandshakeWaitPayload
  | DebugDumpPayload
  | DumpLogsPayload
  | ExtendedConfigLoadedPayload
  | GetExtendedStatusPayload
  | GlobalErrorPayload
  | InstallerRanPayload
  | LinkPayload
  | LoadAvatarsPayload
  | LoadTeamAvatarsPayload
  | LoadedAvatarsPayload
  | MobileAppStatePayload
  | OpenAppSettingsPayload
  | PersistRouteStatePayload
  | PushLoadedPayload
  | RegisterIncomingHandlersPayload
  | SetInitialStatePayload
  | SetNotifySoundPayload
  | SetOpenAtLoginPayload
  | SetStartedDueToPushPayload
  | SetupEngineListenersPayload
  | ShowMainPayload
  | StartHandshakePayload
  | UpdateFollowingPayload
  | {type: 'common:resetStore', payload: void}
