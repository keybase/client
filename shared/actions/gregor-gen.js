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
export const startReachability = 'gregor:startReachability'
export const updateCategory = 'gregor:updateCategory'
export const updateReachable = 'gregor:updateReachable'

// Payload Types
type _CheckReachabilityPayload = void
type _PushOOBMPayload = $ReadOnly<{|messages: Array<RPCTypesGregor.OutOfBandMessage>|}>
type _PushStatePayload = $ReadOnly<{|
  state: Array<{md: RPCTypesGregor.Metadata, item: RPCTypesGregor.Item}>,
  reason: RPCTypes.PushReason,
|}>
type _StartReachabilityPayload = void
type _UpdateCategoryPayload = $ReadOnly<{|
  category: string,
  body: string,
  dtime?: {offset: number, time: number},
|}>
type _UpdateReachablePayload = $ReadOnly<{|reachable: RPCTypes.Reachable|}>

// Action Creators
export const createCheckReachability = (payload: _CheckReachabilityPayload) => ({error: false, payload, type: checkReachability})
export const createPushOOBM = (payload: _PushOOBMPayload) => ({error: false, payload, type: pushOOBM})
export const createPushState = (payload: _PushStatePayload) => ({error: false, payload, type: pushState})
export const createStartReachability = (payload: _StartReachabilityPayload) => ({error: false, payload, type: startReachability})
export const createUpdateCategory = (payload: _UpdateCategoryPayload) => ({error: false, payload, type: updateCategory})
export const createUpdateReachable = (payload: _UpdateReachablePayload) => ({error: false, payload, type: updateReachable})

// Action Payloads
export type CheckReachabilityPayload = $Call<typeof createCheckReachability, _CheckReachabilityPayload>
export type PushOOBMPayload = $Call<typeof createPushOOBM, _PushOOBMPayload>
export type PushStatePayload = $Call<typeof createPushState, _PushStatePayload>
export type StartReachabilityPayload = $Call<typeof createStartReachability, _StartReachabilityPayload>
export type UpdateCategoryPayload = $Call<typeof createUpdateCategory, _UpdateCategoryPayload>
export type UpdateReachablePayload = $Call<typeof createUpdateReachable, _UpdateReachablePayload>

// All Actions
// prettier-ignore
export type Actions =
  | CheckReachabilityPayload
  | PushOOBMPayload
  | PushStatePayload
  | StartReachabilityPayload
  | UpdateCategoryPayload
  | UpdateReachablePayload
  | {type: 'common:resetStore', payload: void}
