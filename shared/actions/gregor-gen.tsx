// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCTypesGregor from '../constants/types/rpc-gregor-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of gregor but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'gregor:'
export const checkReachability = 'gregor:checkReachability'
export const pushOOBM = 'gregor:pushOOBM'
export const pushState = 'gregor:pushState'
export const updateCategory = 'gregor:updateCategory'
export const updateReachable = 'gregor:updateReachable'

// Payload Types
type _CheckReachabilityPayload = void
type _PushOOBMPayload = {readonly messages: Array<RPCTypesGregor.OutOfBandMessage>}
type _PushStatePayload = {
  readonly state: Array<{md: RPCTypesGregor.Metadata; item: RPCTypesGregor.Item}>
  readonly reason: RPCTypes.PushReason
}
type _UpdateCategoryPayload = {
  readonly category: string
  readonly body: string
  readonly dtime?: {offset: number; time: number}
}
type _UpdateReachablePayload = {readonly reachable: RPCTypes.Reachable}

// Action Creators
export const createCheckReachability = (payload: _CheckReachabilityPayload): CheckReachabilityPayload => ({
  payload,
  type: checkReachability,
})
export const createPushOOBM = (payload: _PushOOBMPayload): PushOOBMPayload => ({payload, type: pushOOBM})
export const createPushState = (payload: _PushStatePayload): PushStatePayload => ({payload, type: pushState})
export const createUpdateCategory = (payload: _UpdateCategoryPayload): UpdateCategoryPayload => ({
  payload,
  type: updateCategory,
})
export const createUpdateReachable = (payload: _UpdateReachablePayload): UpdateReachablePayload => ({
  payload,
  type: updateReachable,
})

// Action Payloads
export type CheckReachabilityPayload = {
  readonly payload: _CheckReachabilityPayload
  readonly type: typeof checkReachability
}
export type PushOOBMPayload = {readonly payload: _PushOOBMPayload; readonly type: typeof pushOOBM}
export type PushStatePayload = {readonly payload: _PushStatePayload; readonly type: typeof pushState}
export type UpdateCategoryPayload = {
  readonly payload: _UpdateCategoryPayload
  readonly type: typeof updateCategory
}
export type UpdateReachablePayload = {
  readonly payload: _UpdateReachablePayload
  readonly type: typeof updateReachable
}

// All Actions
// prettier-ignore
export type Actions =
  | CheckReachabilityPayload
  | PushOOBMPayload
  | PushStatePayload
  | UpdateCategoryPayload
  | UpdateReachablePayload
  | {type: 'common:resetStore', payload: {}}
