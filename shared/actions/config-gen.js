// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
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
export const clearRouteState = 'config:clearRouteState'
export const configLoaded = 'config:configLoaded'
export const daemonError = 'config:daemonError'
export const debugDump = 'config:debugDump'
export const extendedConfigLoaded = 'config:extendedConfigLoaded'
export const getExtendedStatus = 'config:getExtendedStatus'
export const globalError = 'config:globalError'
export const loadAvatars = 'config:loadAvatars'
export const loadTeamAvatars = 'config:loadTeamAvatars'
export const loadedAvatars = 'config:loadedAvatars'
export const persistRouteState = 'config:persistRouteState'
export const pushLoaded = 'config:pushLoaded'
export const readyForBootstrap = 'config:readyForBootstrap'
export const retryBootstrap = 'config:retryBootstrap'
export const setInitialState = 'config:setInitialState'
export const setOpenAtLogin = 'config:setOpenAtLogin'
export const setStartedDueToPush = 'config:setStartedDueToPush'
export const updateFollowing = 'config:updateFollowing'

// Action Creators
export const createBootstrap = (payload: $ReadOnly<{|isReconnect?: boolean|}>) => ({error: false, payload, type: bootstrap})
export const createBootstrapAttemptFailed = () => ({error: false, payload: undefined, type: bootstrapAttemptFailed})
export const createBootstrapFailed = () => ({error: false, payload: undefined, type: bootstrapFailed})
export const createBootstrapRetry = () => ({error: false, payload: undefined, type: bootstrapRetry})
export const createBootstrapStatusLoaded = (
  payload: $ReadOnly<{|
    deviceID: string,
    deviceName: string,
    followers?: ?Array<string>,
    following?: ?Array<string>,
    loggedIn: boolean,
    registered: boolean,
    uid: string,
    username: string,
  |}>
) => ({error: false, payload, type: bootstrapStatusLoaded})
export const createBootstrapSuccess = () => ({error: false, payload: undefined, type: bootstrapSuccess})
export const createChangeKBFSPath = (payload: $ReadOnly<{|kbfsPath: string|}>) => ({error: false, payload, type: changeKBFSPath})
export const createClearRouteState = () => ({error: false, payload: undefined, type: clearRouteState})
export const createConfigLoaded = (payload: $ReadOnly<{|config: RPCTypes.Config|}>) => ({error: false, payload, type: configLoaded})
export const createDaemonError = (payload: $ReadOnly<{|daemonError: ?Error|}>) => ({error: false, payload, type: daemonError})
export const createDebugDump = (payload: $ReadOnly<{|items: Array<string>|}>) => ({error: false, payload, type: debugDump})
export const createExtendedConfigLoaded = (payload: $ReadOnly<{|extendedConfig: RPCTypes.ExtendedStatus|}>) => ({error: false, payload, type: extendedConfigLoaded})
export const createGetExtendedStatus = () => ({error: false, payload: undefined, type: getExtendedStatus})
export const createGlobalError = (payload: $ReadOnly<{|globalError: null | Error | RPCError|}>) => ({error: false, payload, type: globalError})
export const createLoadAvatars = (payload: $ReadOnly<{|usernames: Array<string>|}>) => ({error: false, payload, type: loadAvatars})
export const createLoadTeamAvatars = (payload: $ReadOnly<{|teamnames: Array<string>|}>) => ({error: false, payload, type: loadTeamAvatars})
export const createLoadedAvatars = (payload: $ReadOnly<{|nameToUrlMap: {[name: string]: ?Object}|}>) => ({error: false, payload, type: loadedAvatars})
export const createPersistRouteState = () => ({error: false, payload: undefined, type: persistRouteState})
export const createPushLoaded = (payload: $ReadOnly<{|pushLoaded: boolean|}>) => ({error: false, payload, type: pushLoaded})
export const createReadyForBootstrap = () => ({error: false, payload: undefined, type: readyForBootstrap})
export const createRetryBootstrap = () => ({error: false, payload: undefined, type: retryBootstrap})
export const createSetInitialState = (payload: $ReadOnly<{|initialState: ?Types.InitialState|}>) => ({error: false, payload, type: setInitialState})
export const createSetOpenAtLogin = (
  payload: $ReadOnly<{|
    open: boolean,
    writeFile: boolean,
  |}>
) => ({error: false, payload, type: setOpenAtLogin})
export const createSetStartedDueToPush = () => ({error: false, payload: undefined, type: setStartedDueToPush})
export const createUpdateFollowing = (
  payload: $ReadOnly<{|
    username: string,
    isTracking: boolean,
  |}>
) => ({error: false, payload, type: updateFollowing})

// Action Payloads
export type BootstrapAttemptFailedPayload = More.ReturnType<typeof createBootstrapAttemptFailed>
export type BootstrapFailedPayload = More.ReturnType<typeof createBootstrapFailed>
export type BootstrapPayload = More.ReturnType<typeof createBootstrap>
export type BootstrapRetryPayload = More.ReturnType<typeof createBootstrapRetry>
export type BootstrapStatusLoadedPayload = More.ReturnType<typeof createBootstrapStatusLoaded>
export type BootstrapSuccessPayload = More.ReturnType<typeof createBootstrapSuccess>
export type ChangeKBFSPathPayload = More.ReturnType<typeof createChangeKBFSPath>
export type ClearRouteStatePayload = More.ReturnType<typeof createClearRouteState>
export type ConfigLoadedPayload = More.ReturnType<typeof createConfigLoaded>
export type DaemonErrorPayload = More.ReturnType<typeof createDaemonError>
export type DebugDumpPayload = More.ReturnType<typeof createDebugDump>
export type ExtendedConfigLoadedPayload = More.ReturnType<typeof createExtendedConfigLoaded>
export type GetExtendedStatusPayload = More.ReturnType<typeof createGetExtendedStatus>
export type GlobalErrorPayload = More.ReturnType<typeof createGlobalError>
export type LoadAvatarsPayload = More.ReturnType<typeof createLoadAvatars>
export type LoadTeamAvatarsPayload = More.ReturnType<typeof createLoadTeamAvatars>
export type LoadedAvatarsPayload = More.ReturnType<typeof createLoadedAvatars>
export type PersistRouteStatePayload = More.ReturnType<typeof createPersistRouteState>
export type PushLoadedPayload = More.ReturnType<typeof createPushLoaded>
export type ReadyForBootstrapPayload = More.ReturnType<typeof createReadyForBootstrap>
export type RetryBootstrapPayload = More.ReturnType<typeof createRetryBootstrap>
export type SetInitialStatePayload = More.ReturnType<typeof createSetInitialState>
export type SetOpenAtLoginPayload = More.ReturnType<typeof createSetOpenAtLogin>
export type SetStartedDueToPushPayload = More.ReturnType<typeof createSetStartedDueToPush>
export type UpdateFollowingPayload = More.ReturnType<typeof createUpdateFollowing>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createBootstrap>
  | More.ReturnType<typeof createBootstrapAttemptFailed>
  | More.ReturnType<typeof createBootstrapFailed>
  | More.ReturnType<typeof createBootstrapRetry>
  | More.ReturnType<typeof createBootstrapStatusLoaded>
  | More.ReturnType<typeof createBootstrapSuccess>
  | More.ReturnType<typeof createChangeKBFSPath>
  | More.ReturnType<typeof createClearRouteState>
  | More.ReturnType<typeof createConfigLoaded>
  | More.ReturnType<typeof createDaemonError>
  | More.ReturnType<typeof createDebugDump>
  | More.ReturnType<typeof createExtendedConfigLoaded>
  | More.ReturnType<typeof createGetExtendedStatus>
  | More.ReturnType<typeof createGlobalError>
  | More.ReturnType<typeof createLoadAvatars>
  | More.ReturnType<typeof createLoadTeamAvatars>
  | More.ReturnType<typeof createLoadedAvatars>
  | More.ReturnType<typeof createPersistRouteState>
  | More.ReturnType<typeof createPushLoaded>
  | More.ReturnType<typeof createReadyForBootstrap>
  | More.ReturnType<typeof createRetryBootstrap>
  | More.ReturnType<typeof createSetInitialState>
  | More.ReturnType<typeof createSetOpenAtLogin>
  | More.ReturnType<typeof createSetStartedDueToPush>
  | More.ReturnType<typeof createUpdateFollowing>
  | {type: 'common:resetStore', payload: void}
