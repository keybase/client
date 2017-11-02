// @flow
/* eslint-disable */

// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/config'
import * as RPCTypes from '../constants/types/flow-types'

// Constants
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
export const globalError = 'config:globalError'
export const persistRouteState = 'config:persistRouteState'
export const pushLoaded = 'config:pushLoaded'
export const readyForBootstrap = 'config:readyForBootstrap'
export const setInitialState = 'config:setInitialState'
export const updateFollowing = 'config:updateFollowing'

// Action Creators
export const createBootstrap = (payload: {|isReconnect?: boolean|}) => ({error: false, payload, type: bootstrap})
export const createBootstrapAttemptFailed = () => ({error: false, payload: undefined, type: bootstrapAttemptFailed})
export const createBootstrapFailed = () => ({error: false, payload: undefined, type: bootstrapFailed})
export const createBootstrapRetry = () => ({error: false, payload: undefined, type: bootstrapRetry})
export const createBootstrapStatusLoaded = (payload: {|bootstrapStatus: RPCTypes.BootstrapStatus|}) => ({error: false, payload, type: bootstrapStatusLoaded})
export const createBootstrapSuccess = () => ({error: false, payload: undefined, type: bootstrapSuccess})
export const createChangeKBFSPath = (payload: {|kbfsPath: string|}) => ({error: false, payload, type: changeKBFSPath})
export const createClearRouteState = () => ({error: false, payload: undefined, type: clearRouteState})
export const createConfigLoaded = (payload: {|config: RPCTypes.Config|}) => ({error: false, payload, type: configLoaded})
export const createDaemonError = (payload: {|daemonError: ?Error|}) => ({error: false, payload, type: daemonError})
export const createExtendedConfigLoaded = (payload: {|extendedConfig: RPCTypes.ExtendedStatus|}) => ({error: false, payload, type: extendedConfigLoaded})
export const createGlobalError = (payload: {|globalError: ?Error|}) => ({error: false, payload, type: globalError})
export const createPersistRouteState = () => ({error: false, payload: undefined, type: persistRouteState})
export const createPushLoaded = (payload: {|pushLoaded: boolean|}) => ({error: false, payload, type: pushLoaded})
export const createReadyForBootstrap = () => ({error: false, payload: undefined, type: readyForBootstrap})
export const createSetInitialState = (payload: {|initialState: Constants.InitialState|}) => ({error: false, payload, type: setInitialState})
export const createUpdateFollowing = (payload: {|username: string, isTracking: boolean|}) => ({error: false, payload, type: updateFollowing})

// Action Payloads
export type BootstrapAttemptFailedPayload = ReturnType<typeof createBootstrapAttemptFailed>
export type BootstrapFailedPayload = ReturnType<typeof createBootstrapFailed>
export type BootstrapPayload = ReturnType<typeof createBootstrap>
export type BootstrapRetryPayload = ReturnType<typeof createBootstrapRetry>
export type BootstrapStatusLoadedPayload = ReturnType<typeof createBootstrapStatusLoaded>
export type BootstrapSuccessPayload = ReturnType<typeof createBootstrapSuccess>
export type ChangeKBFSPathPayload = ReturnType<typeof createChangeKBFSPath>
export type ClearRouteStatePayload = ReturnType<typeof createClearRouteState>
export type ConfigLoadedPayload = ReturnType<typeof createConfigLoaded>
export type DaemonErrorPayload = ReturnType<typeof createDaemonError>
export type ExtendedConfigLoadedPayload = ReturnType<typeof createExtendedConfigLoaded>
export type GlobalErrorPayload = ReturnType<typeof createGlobalError>
export type PersistRouteStatePayload = ReturnType<typeof createPersistRouteState>
export type PushLoadedPayload = ReturnType<typeof createPushLoaded>
export type ReadyForBootstrapPayload = ReturnType<typeof createReadyForBootstrap>
export type SetInitialStatePayload = ReturnType<typeof createSetInitialState>
export type UpdateFollowingPayload = ReturnType<typeof createUpdateFollowing>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createBootstrap>
  | ReturnType<typeof createBootstrapAttemptFailed>
  | ReturnType<typeof createBootstrapFailed>
  | ReturnType<typeof createBootstrapRetry>
  | ReturnType<typeof createBootstrapStatusLoaded>
  | ReturnType<typeof createBootstrapSuccess>
  | ReturnType<typeof createChangeKBFSPath>
  | ReturnType<typeof createClearRouteState>
  | ReturnType<typeof createConfigLoaded>
  | ReturnType<typeof createDaemonError>
  | ReturnType<typeof createExtendedConfigLoaded>
  | ReturnType<typeof createGlobalError>
  | ReturnType<typeof createPersistRouteState>
  | ReturnType<typeof createPushLoaded>
  | ReturnType<typeof createReadyForBootstrap>
  | ReturnType<typeof createSetInitialState>
  | ReturnType<typeof createUpdateFollowing>
