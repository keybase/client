// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as RPCTypesGregor from '../constants/types/rpc-gregor-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of gregor but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'gregor:'
export const pushState = 'gregor:pushState'

// Action Creators
export const createPushState = (payload: {
  readonly state: Array<{md: RPCTypesGregor.Metadata; item: RPCTypesGregor.Item}>
  readonly reason: RPCTypes.PushReason
}) => ({payload, type: pushState as typeof pushState})

// Action Payloads
export type PushStatePayload = ReturnType<typeof createPushState>

// All Actions
// prettier-ignore
export type Actions =
  | PushStatePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
