// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of waiting but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'waiting:'
export const batchChangeWaiting = 'waiting:batchChangeWaiting'
export const clearWaiting = 'waiting:clearWaiting'
export const decrementWaiting = 'waiting:decrementWaiting'
export const incrementWaiting = 'waiting:incrementWaiting'

// Payload Types
type _BatchChangeWaitingPayload = {
  readonly changes: Array<{key: string | Array<string>; increment: boolean; error?: RPCError}>
}
type _ClearWaitingPayload = {readonly key: string | Array<string>}
type _DecrementWaitingPayload = {readonly key: string | Array<string>; readonly error?: RPCError}
type _IncrementWaitingPayload = {readonly key: string | Array<string>}

// Action Creators
export const createBatchChangeWaiting = (payload: _BatchChangeWaitingPayload): BatchChangeWaitingPayload => ({
  payload,
  type: batchChangeWaiting,
})
export const createClearWaiting = (payload: _ClearWaitingPayload): ClearWaitingPayload => ({
  payload,
  type: clearWaiting,
})
export const createDecrementWaiting = (payload: _DecrementWaitingPayload): DecrementWaitingPayload => ({
  payload,
  type: decrementWaiting,
})
export const createIncrementWaiting = (payload: _IncrementWaitingPayload): IncrementWaitingPayload => ({
  payload,
  type: incrementWaiting,
})

// Action Payloads
export type BatchChangeWaitingPayload = {
  readonly payload: _BatchChangeWaitingPayload
  readonly type: typeof batchChangeWaiting
}
export type ClearWaitingPayload = {readonly payload: _ClearWaitingPayload; readonly type: typeof clearWaiting}
export type DecrementWaitingPayload = {
  readonly payload: _DecrementWaitingPayload
  readonly type: typeof decrementWaiting
}
export type IncrementWaitingPayload = {
  readonly payload: _IncrementWaitingPayload
  readonly type: typeof incrementWaiting
}

// All Actions
// prettier-ignore
export type Actions =
  | BatchChangeWaitingPayload
  | ClearWaitingPayload
  | DecrementWaitingPayload
  | IncrementWaitingPayload
  | {type: 'common:resetStore', payload: {}}
