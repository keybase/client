// @flow
/* eslint-disable */

// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/config'
import * as RPCTypes from '../constants/types/flow-types'

// Constants
export const bootstrapStatusLoaded = 'config:bootstrapStatusLoaded'
export const daemonError = 'config:daemonError'
export const pushLoaded = 'config:pushLoaded'
export const setInitialState = 'config:setInitialState'
export const updateFollowing = 'config:updateFollowing'

// Action Creators
export const createBootstrapStatusLoaded = (payload: {|bootstrapStatus: RPCTypes.BootstrapStatus|}) => ({error: false, payload, type: bootstrapStatusLoaded})
export const createDaemonError = (payload: {|daemonError: ?Error|}) => ({error: false, payload, type: daemonError})
export const createPushLoaded = (payload: {|isLoaded: boolean|}) => ({error: false, payload, type: pushLoaded})
export const createSetInitialState = (payload: {|initialState: Constants.InitialState|}) => ({error: false, payload, type: setInitialState})
export const createUpdateFollowing = (payload: {|username: string, isTracking: boolean|}) => ({error: false, payload, type: updateFollowing})

// Action Payloads
export type BootstrapStatusLoadedPayload = ReturnType<typeof createBootstrapStatusLoaded>
export type DaemonErrorPayload = ReturnType<typeof createDaemonError>
export type PushLoadedPayload = ReturnType<typeof createPushLoaded>
export type SetInitialStatePayload = ReturnType<typeof createSetInitialState>
export type UpdateFollowingPayload = ReturnType<typeof createUpdateFollowing>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createBootstrapStatusLoaded>
  | ReturnType<typeof createDaemonError>
  | ReturnType<typeof createPushLoaded>
  | ReturnType<typeof createSetInitialState>
  | ReturnType<typeof createUpdateFollowing>
