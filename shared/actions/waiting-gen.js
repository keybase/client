// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of waiting but is handled by every reducer
export const decrementWaiting = 'waiting:decrementWaiting'
export const incrementWaiting = 'waiting:incrementWaiting'

// Payload Types
type _DecrementWaitingPayload = $ReadOnly<{|key: string | Array<string>|}>
type _IncrementWaitingPayload = $ReadOnly<{|key: string | Array<string>|}>

// Action Creators
export const createDecrementWaiting = (payload: _DecrementWaitingPayload) => ({error: false, payload, type: decrementWaiting})
export const createIncrementWaiting = (payload: _IncrementWaitingPayload) => ({error: false, payload, type: incrementWaiting})

// Action Payloads
export type DecrementWaitingPayload = $Call<typeof createDecrementWaiting, _DecrementWaitingPayload>
export type IncrementWaitingPayload = $Call<typeof createIncrementWaiting, _IncrementWaitingPayload>

// All Actions
// prettier-ignore
export type Actions =
  | DecrementWaitingPayload
  | IncrementWaitingPayload
  | {type: 'common:resetStore', payload: void}
