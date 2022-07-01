// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as RPCTypesGregor from '../constants/types/rpc-gregor-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of gregor but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'gregor:'
export const checkReachability = 'gregor:checkReachability'
export const pushOOBM = 'gregor:pushOOBM'
export const pushState = 'gregor:pushState'
export const updateCategory = 'gregor:updateCategory'
export const updateReachable = 'gregor:updateReachable'

// Action Creators
export const createCheckReachability = (payload?: undefined) => ({
  payload,
  type: checkReachability as typeof checkReachability,
})
export const createPushOOBM = (payload: {readonly messages: Array<RPCTypesGregor.OutOfBandMessage>}) => ({
  payload,
  type: pushOOBM as typeof pushOOBM,
})
export const createPushState = (payload: {
  readonly state: Array<{md: RPCTypesGregor.Metadata; item: RPCTypesGregor.Item}>
  readonly reason: RPCTypes.PushReason
}) => ({payload, type: pushState as typeof pushState})
export const createUpdateCategory = (payload: {
  readonly category: string
  readonly body: string
  readonly dtime?: {offset: number; time: number}
}) => ({payload, type: updateCategory as typeof updateCategory})
export const createUpdateReachable = (payload: {readonly reachable: RPCTypes.Reachable}) => ({
  payload,
  type: updateReachable as typeof updateReachable,
})

// Action Payloads
export type CheckReachabilityPayload = ReturnType<typeof createCheckReachability>
export type PushOOBMPayload = ReturnType<typeof createPushOOBM>
export type PushStatePayload = ReturnType<typeof createPushState>
export type UpdateCategoryPayload = ReturnType<typeof createUpdateCategory>
export type UpdateReachablePayload = ReturnType<typeof createUpdateReachable>

// All Actions
// prettier-ignore
export type Actions =
  | CheckReachabilityPayload
  | PushOOBMPayload
  | PushStatePayload
  | UpdateCategoryPayload
  | UpdateReachablePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
