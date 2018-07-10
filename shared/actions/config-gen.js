// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/config'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of config but is handled by every reducer
export const bootstrap = 'config:bootstrap'
export const bootstrapAttemptFailed = 'config:bootstrapAttemptFailed'
export const bootstrapFailed = 'config:bootstrapFailed'
export const bootstrapRetry = 'config:bootstrapRetry'
export const bootstrapStatusLoaded = 'config:bootstrapStatusLoaded'
export const bootstrapSuccess = 'config:bootstrapSuccess'
export const changeKBFSPath = 'config:changeKBFSPath'
export const changedActive = 'config:changedActive'
export const changedFocus = 'config:changedFocus'
export const clearRouteState = 'config:clearRouteState'
export const configLoaded = 'config:configLoaded'
export const daemonError = 'config:daemonError'
export const debugDump = 'config:debugDump'
export const dumpLogs = 'config:dumpLogs'
export const extendedConfigLoaded = 'config:extendedConfigLoaded'
export const getExtendedStatus = 'config:getExtendedStatus'
export const globalError = 'config:globalError'
export const link = 'config:link'
export const loadAvatars = 'config:loadAvatars'
export const loadConfig = 'config:loadConfig'
export const loadTeamAvatars = 'config:loadTeamAvatars'
export const loadedAvatars = 'config:loadedAvatars'
export const mobileAppState = 'config:mobileAppState'
export const persistRouteState = 'config:persistRouteState'
export const pushLoaded = 'config:pushLoaded'
export const readyForBootstrap = 'config:readyForBootstrap'
export const retryBootstrap = 'config:retryBootstrap'
export const setInitialState = 'config:setInitialState'
export const setOpenAtLogin = 'config:setOpenAtLogin'
export const setStartedDueToPush = 'config:setStartedDueToPush'
export const showMain = 'config:showMain'
export const updateFollowing = 'config:updateFollowing'

// Payload Types
type _BootstrapAttemptFailedPayload = void
type _BootstrapFailedPayload = void
type _BootstrapPayload = $ReadOnly<{|isReconnect?: boolean|}>
type _BootstrapRetryPayload = void
type _BootstrapStatusLoadedPayload = $ReadOnly<{|
  deviceID: string,
  deviceName: string,
  followers?: ?Array<string>,
  following?: ?Array<string>,
  loggedIn: boolean,
  registered: boolean,
  uid: string,
  username: string,
|}>
type _BootstrapSuccessPayload = void
type _ChangeKBFSPathPayload = $ReadOnly<{|kbfsPath: string|}>
type _ChangedActivePayload = $ReadOnly<{|userActive: boolean|}>
type _ChangedFocusPayload = $ReadOnly<{|appFocused: boolean|}>
type _ClearRouteStatePayload = void
type _ConfigLoadedPayload = $ReadOnly<{|config: RPCTypes.Config|}>
type _DaemonErrorPayload = $ReadOnly<{|daemonError: ?Error|}>
type _DebugDumpPayload = $ReadOnly<{|items: Array<string>|}>
type _DumpLogsPayload = $ReadOnly<{|reason: 'quitting through menu'|}>
type _ExtendedConfigLoadedPayload = $ReadOnly<{|extendedConfig: RPCTypes.ExtendedStatus|}>
type _GetExtendedStatusPayload = void
type _GlobalErrorPayload = $ReadOnly<{|globalError: null | Error | RPCError|}>
type _LinkPayload = $ReadOnly<{|link: string|}>
type _LoadAvatarsPayload = $ReadOnly<{|usernames: Array<string>|}>
type _LoadConfigPayload = $ReadOnly<{|logVersion?: boolean|}>
type _LoadTeamAvatarsPayload = $ReadOnly<{|teamnames: Array<string>|}>
type _LoadedAvatarsPayload = $ReadOnly<{|nameToUrlMap: {[name: string]: ?Object}|}>
type _MobileAppStatePayload = $ReadOnly<{|nextAppState: 'active' | 'background' | 'inactive'|}>
type _PersistRouteStatePayload = void
type _PushLoadedPayload = $ReadOnly<{|pushLoaded: boolean|}>
type _ReadyForBootstrapPayload = void
type _RetryBootstrapPayload = void
type _SetInitialStatePayload = $ReadOnly<{|initialState: ?Types.InitialState|}>
type _SetOpenAtLoginPayload = $ReadOnly<{|
  open: boolean,
  writeFile: boolean,
|}>
type _SetStartedDueToPushPayload = void
type _ShowMainPayload = void
type _UpdateFollowingPayload = $ReadOnly<{|
  username: string,
  isTracking: boolean,
|}>

// Action Creators
export const createBootstrap = (payload: _BootstrapPayload) => ({error: false, payload, type: bootstrap})
export const createBootstrapAttemptFailed = (payload: _BootstrapAttemptFailedPayload) => ({error: false, payload, type: bootstrapAttemptFailed})
export const createBootstrapFailed = (payload: _BootstrapFailedPayload) => ({error: false, payload, type: bootstrapFailed})
export const createBootstrapRetry = (payload: _BootstrapRetryPayload) => ({error: false, payload, type: bootstrapRetry})
export const createBootstrapStatusLoaded = (payload: _BootstrapStatusLoadedPayload) => ({error: false, payload, type: bootstrapStatusLoaded})
export const createBootstrapSuccess = (payload: _BootstrapSuccessPayload) => ({error: false, payload, type: bootstrapSuccess})
export const createChangeKBFSPath = (payload: _ChangeKBFSPathPayload) => ({error: false, payload, type: changeKBFSPath})
export const createChangedActive = (payload: _ChangedActivePayload) => ({error: false, payload, type: changedActive})
export const createChangedFocus = (payload: _ChangedFocusPayload) => ({error: false, payload, type: changedFocus})
export const createClearRouteState = (payload: _ClearRouteStatePayload) => ({error: false, payload, type: clearRouteState})
export const createConfigLoaded = (payload: _ConfigLoadedPayload) => ({error: false, payload, type: configLoaded})
export const createDaemonError = (payload: _DaemonErrorPayload) => ({error: false, payload, type: daemonError})
export const createDebugDump = (payload: _DebugDumpPayload) => ({error: false, payload, type: debugDump})
export const createDumpLogs = (payload: _DumpLogsPayload) => ({error: false, payload, type: dumpLogs})
export const createExtendedConfigLoaded = (payload: _ExtendedConfigLoadedPayload) => ({error: false, payload, type: extendedConfigLoaded})
export const createGetExtendedStatus = (payload: _GetExtendedStatusPayload) => ({error: false, payload, type: getExtendedStatus})
export const createGlobalError = (payload: _GlobalErrorPayload) => ({error: false, payload, type: globalError})
export const createLink = (payload: _LinkPayload) => ({error: false, payload, type: link})
export const createLoadAvatars = (payload: _LoadAvatarsPayload) => ({error: false, payload, type: loadAvatars})
export const createLoadConfig = (payload: _LoadConfigPayload) => ({error: false, payload, type: loadConfig})
export const createLoadTeamAvatars = (payload: _LoadTeamAvatarsPayload) => ({error: false, payload, type: loadTeamAvatars})
export const createLoadedAvatars = (payload: _LoadedAvatarsPayload) => ({error: false, payload, type: loadedAvatars})
export const createMobileAppState = (payload: _MobileAppStatePayload) => ({error: false, payload, type: mobileAppState})
export const createPersistRouteState = (payload: _PersistRouteStatePayload) => ({error: false, payload, type: persistRouteState})
export const createPushLoaded = (payload: _PushLoadedPayload) => ({error: false, payload, type: pushLoaded})
export const createReadyForBootstrap = (payload: _ReadyForBootstrapPayload) => ({error: false, payload, type: readyForBootstrap})
export const createRetryBootstrap = (payload: _RetryBootstrapPayload) => ({error: false, payload, type: retryBootstrap})
export const createSetInitialState = (payload: _SetInitialStatePayload) => ({error: false, payload, type: setInitialState})
export const createSetOpenAtLogin = (payload: _SetOpenAtLoginPayload) => ({error: false, payload, type: setOpenAtLogin})
export const createSetStartedDueToPush = (payload: _SetStartedDueToPushPayload) => ({error: false, payload, type: setStartedDueToPush})
export const createShowMain = (payload: _ShowMainPayload) => ({error: false, payload, type: showMain})
export const createUpdateFollowing = (payload: _UpdateFollowingPayload) => ({error: false, payload, type: updateFollowing})

// Action Payloads
export type BootstrapAttemptFailedPayload = $Call<typeof createBootstrapAttemptFailed, _BootstrapAttemptFailedPayload>
export type BootstrapFailedPayload = $Call<typeof createBootstrapFailed, _BootstrapFailedPayload>
export type BootstrapPayload = $Call<typeof createBootstrap, _BootstrapPayload>
export type BootstrapRetryPayload = $Call<typeof createBootstrapRetry, _BootstrapRetryPayload>
export type BootstrapStatusLoadedPayload = $Call<typeof createBootstrapStatusLoaded, _BootstrapStatusLoadedPayload>
export type BootstrapSuccessPayload = $Call<typeof createBootstrapSuccess, _BootstrapSuccessPayload>
export type ChangeKBFSPathPayload = $Call<typeof createChangeKBFSPath, _ChangeKBFSPathPayload>
export type ChangedActivePayload = $Call<typeof createChangedActive, _ChangedActivePayload>
export type ChangedFocusPayload = $Call<typeof createChangedFocus, _ChangedFocusPayload>
export type ClearRouteStatePayload = $Call<typeof createClearRouteState, _ClearRouteStatePayload>
export type ConfigLoadedPayload = $Call<typeof createConfigLoaded, _ConfigLoadedPayload>
export type DaemonErrorPayload = $Call<typeof createDaemonError, _DaemonErrorPayload>
export type DebugDumpPayload = $Call<typeof createDebugDump, _DebugDumpPayload>
export type DumpLogsPayload = $Call<typeof createDumpLogs, _DumpLogsPayload>
export type ExtendedConfigLoadedPayload = $Call<typeof createExtendedConfigLoaded, _ExtendedConfigLoadedPayload>
export type GetExtendedStatusPayload = $Call<typeof createGetExtendedStatus, _GetExtendedStatusPayload>
export type GlobalErrorPayload = $Call<typeof createGlobalError, _GlobalErrorPayload>
export type LinkPayload = $Call<typeof createLink, _LinkPayload>
export type LoadAvatarsPayload = $Call<typeof createLoadAvatars, _LoadAvatarsPayload>
export type LoadConfigPayload = $Call<typeof createLoadConfig, _LoadConfigPayload>
export type LoadTeamAvatarsPayload = $Call<typeof createLoadTeamAvatars, _LoadTeamAvatarsPayload>
export type LoadedAvatarsPayload = $Call<typeof createLoadedAvatars, _LoadedAvatarsPayload>
export type MobileAppStatePayload = $Call<typeof createMobileAppState, _MobileAppStatePayload>
export type PersistRouteStatePayload = $Call<typeof createPersistRouteState, _PersistRouteStatePayload>
export type PushLoadedPayload = $Call<typeof createPushLoaded, _PushLoadedPayload>
export type ReadyForBootstrapPayload = $Call<typeof createReadyForBootstrap, _ReadyForBootstrapPayload>
export type RetryBootstrapPayload = $Call<typeof createRetryBootstrap, _RetryBootstrapPayload>
export type SetInitialStatePayload = $Call<typeof createSetInitialState, _SetInitialStatePayload>
export type SetOpenAtLoginPayload = $Call<typeof createSetOpenAtLogin, _SetOpenAtLoginPayload>
export type SetStartedDueToPushPayload = $Call<typeof createSetStartedDueToPush, _SetStartedDueToPushPayload>
export type ShowMainPayload = $Call<typeof createShowMain, _ShowMainPayload>
export type UpdateFollowingPayload = $Call<typeof createUpdateFollowing, _UpdateFollowingPayload>

// All Actions
// prettier-ignore
export type Actions =
  | BootstrapAttemptFailedPayload
  | BootstrapFailedPayload
  | BootstrapPayload
  | BootstrapRetryPayload
  | BootstrapStatusLoadedPayload
  | BootstrapSuccessPayload
  | ChangeKBFSPathPayload
  | ChangedActivePayload
  | ChangedFocusPayload
  | ClearRouteStatePayload
  | ConfigLoadedPayload
  | DaemonErrorPayload
  | DebugDumpPayload
  | DumpLogsPayload
  | ExtendedConfigLoadedPayload
  | GetExtendedStatusPayload
  | GlobalErrorPayload
  | LinkPayload
  | LoadAvatarsPayload
  | LoadConfigPayload
  | LoadTeamAvatarsPayload
  | LoadedAvatarsPayload
  | MobileAppStatePayload
  | PersistRouteStatePayload
  | PushLoadedPayload
  | ReadyForBootstrapPayload
  | RetryBootstrapPayload
  | SetInitialStatePayload
  | SetOpenAtLoginPayload
  | SetStartedDueToPushPayload
  | ShowMainPayload
  | UpdateFollowingPayload
  | {type: 'common:resetStore', payload: void}
