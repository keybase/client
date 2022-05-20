// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of waiting but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'waiting:'
export const batchChangeWaiting = 'waiting:batchChangeWaiting'
export const clearWaiting = 'waiting:clearWaiting'
export const decrementWaiting = 'waiting:decrementWaiting'
export const incrementWaiting = 'waiting:incrementWaiting'

// Action Creators
export const createBatchChangeWaiting = (payload: {
  readonly changes: Array<{key: string | Array<string>; increment: boolean; error?: RPCError}>
}) => ({payload, type: batchChangeWaiting as typeof batchChangeWaiting})
export const createClearWaiting = (payload: {readonly key: string | Array<string>}) => ({
  payload,
  type: clearWaiting as typeof clearWaiting,
})
export const createDecrementWaiting = (payload: {
  readonly key: string | Array<string>
  readonly error?: RPCError
}) => ({payload, type: decrementWaiting as typeof decrementWaiting})
export const createIncrementWaiting = (payload: {readonly key: string | Array<string>}) => ({
  payload,
  type: incrementWaiting as typeof incrementWaiting,
})

// Action Payloads
export type BatchChangeWaitingPayload = ReturnType<typeof createBatchChangeWaiting>
export type ClearWaitingPayload = ReturnType<typeof createClearWaiting>
export type DecrementWaitingPayload = ReturnType<typeof createDecrementWaiting>
export type IncrementWaitingPayload = ReturnType<typeof createIncrementWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | BatchChangeWaitingPayload
  | ClearWaitingPayload
  | DecrementWaitingPayload
  | IncrementWaitingPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
