// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Constants from '../constants/config'

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
export const extendedConfigLoaded = 'config:extendedConfigLoaded'
export const getExtendedStatus = 'config:getExtendedStatus'
export const globalError = 'config:globalError'
export const persistRouteState = 'config:persistRouteState'
export const pushLoaded = 'config:pushLoaded'
export const readyForBootstrap = 'config:readyForBootstrap'
export const retryBootstrap = 'config:retryBootstrap'
export const setInitialState = 'config:setInitialState'
export const updateFollowing = 'config:updateFollowing'

// Action Creators
export const createBootstrap = (payload: {|+isReconnect?: boolean|}) => ({error: false, payload, type: bootstrap})
export const createBootstrapAttemptFailed = () => ({error: false, payload: undefined, type: bootstrapAttemptFailed})
export const createBootstrapFailed = () => ({error: false, payload: undefined, type: bootstrapFailed})
export const createBootstrapRetry = () => ({error: false, payload: undefined, type: bootstrapRetry})
export const createBootstrapStatusLoaded = (payload: {|+bootstrapStatus: RPCTypes.BootstrapStatus|}) => ({error: false, payload, type: bootstrapStatusLoaded})
export const createBootstrapSuccess = () => ({error: false, payload: undefined, type: bootstrapSuccess})
export const createChangeKBFSPath = (payload: {|+kbfsPath: string|}) => ({error: false, payload, type: changeKBFSPath})
export const createClearRouteState = () => ({error: false, payload: undefined, type: clearRouteState})
export const createConfigLoaded = (payload: {|+config: RPCTypes.Config|}) => ({error: false, payload, type: configLoaded})
export const createDaemonError = (payload: {|+daemonError: ?Error|}) => ({error: false, payload, type: daemonError})
export const createExtendedConfigLoaded = (payload: {|+extendedConfig: RPCTypes.ExtendedStatus|}) => ({error: false, payload, type: extendedConfigLoaded})
export const createGetExtendedStatus = () => ({error: false, payload: undefined, type: getExtendedStatus})
export const createGlobalError = (payload: {|+globalError: ?Error|}) => ({error: false, payload, type: globalError})
export const createPersistRouteState = () => ({error: false, payload: undefined, type: persistRouteState})
export const createPushLoaded = (payload: {|+pushLoaded: boolean|}) => ({error: false, payload, type: pushLoaded})
export const createReadyForBootstrap = () => ({error: false, payload: undefined, type: readyForBootstrap})
export const createRetryBootstrap = () => ({error: false, payload: undefined, type: retryBootstrap})
export const createSetInitialState = (payload: {|+initialState: Constants.InitialState|}) => ({error: false, payload, type: setInitialState})
export const createUpdateFollowing = (payload: {|+username: string, +isTracking: boolean|}) => ({error: false, payload, type: updateFollowing})

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
export type ExtendedConfigLoadedPayload = More.ReturnType<typeof createExtendedConfigLoaded>
export type GetExtendedStatusPayload = More.ReturnType<typeof createGetExtendedStatus>
export type GlobalErrorPayload = More.ReturnType<typeof createGlobalError>
export type PersistRouteStatePayload = More.ReturnType<typeof createPersistRouteState>
export type PushLoadedPayload = More.ReturnType<typeof createPushLoaded>
export type ReadyForBootstrapPayload = More.ReturnType<typeof createReadyForBootstrap>
export type RetryBootstrapPayload = More.ReturnType<typeof createRetryBootstrap>
export type SetInitialStatePayload = More.ReturnType<typeof createSetInitialState>
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
  | More.ReturnType<typeof createExtendedConfigLoaded>
  | More.ReturnType<typeof createGetExtendedStatus>
  | More.ReturnType<typeof createGlobalError>
  | More.ReturnType<typeof createPersistRouteState>
  | More.ReturnType<typeof createPushLoaded>
  | More.ReturnType<typeof createReadyForBootstrap>
  | More.ReturnType<typeof createRetryBootstrap>
  | More.ReturnType<typeof createSetInitialState>
  | More.ReturnType<typeof createUpdateFollowing>
  | {type: 'common:resetStore', payload: void}
