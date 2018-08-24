// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/gregor'
import * as RPCTypesGregor from '../constants/types/rpc-gregor-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of gregor but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'gregor:'
export const checkReachability = 'gregor:checkReachability'
export const pushOOBM = 'gregor:pushOOBM'
export const pushState = 'gregor:pushState'
export const updateCategory = 'gregor:updateCategory'
export const updateReachability = 'gregor:updateReachability'
export const updateSeenMsgs = 'gregor:updateSeenMsgs'

// Payload Types
type _CheckReachabilityPayload = void
type _PushOOBMPayload = $ReadOnly<{|messages: Array<RPCTypesGregor.OutOfBandMessage>|}>
type _PushStatePayload = $ReadOnly<{|
  state: RPCTypesGregor.State,
  reason: RPCTypes.PushReason,
|}>
type _UpdateCategoryPayload = $ReadOnly<{|
  category: string,
  body: string,
  dtime?: {offset: number, time: number},
|}>
type _UpdateReachabilityPayload = $ReadOnly<{|reachability: RPCTypes.Reachability|}>
type _UpdateSeenMsgsPayload = $ReadOnly<{|seenMsgs: Array<Types.NonNullGregorItem>|}>

// Action Creators
export const createCheckReachability = (payload: _CheckReachabilityPayload) => ({error: false, payload, type: checkReachability})
export const createPushOOBM = (payload: _PushOOBMPayload) => ({error: false, payload, type: pushOOBM})
export const createPushState = (payload: _PushStatePayload) => ({error: false, payload, type: pushState})
export const createUpdateCategory = (payload: _UpdateCategoryPayload) => ({error: false, payload, type: updateCategory})
export const createUpdateReachability = (payload: _UpdateReachabilityPayload) => ({error: false, payload, type: updateReachability})
export const createUpdateSeenMsgs = (payload: _UpdateSeenMsgsPayload) => ({error: false, payload, type: updateSeenMsgs})

// Action Payloads
export type CheckReachabilityPayload = $Call<typeof createCheckReachability, _CheckReachabilityPayload>
export type PushOOBMPayload = $Call<typeof createPushOOBM, _PushOOBMPayload>
export type PushStatePayload = $Call<typeof createPushState, _PushStatePayload>
export type UpdateCategoryPayload = $Call<typeof createUpdateCategory, _UpdateCategoryPayload>
export type UpdateReachabilityPayload = $Call<typeof createUpdateReachability, _UpdateReachabilityPayload>
export type UpdateSeenMsgsPayload = $Call<typeof createUpdateSeenMsgs, _UpdateSeenMsgsPayload>

// All Actions
// prettier-ignore
export type Actions =
  | CheckReachabilityPayload
  | PushOOBMPayload
  | PushStatePayload
  | UpdateCategoryPayload
  | UpdateReachabilityPayload
  | UpdateSeenMsgsPayload
  | {type: 'common:resetStore', payload: void}
