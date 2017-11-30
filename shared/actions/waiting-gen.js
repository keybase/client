// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of waiting but is handled by every reducer
export const decrementWaiting = 'waiting:decrementWaiting'
export const incrementWaiting = 'waiting:incrementWaiting'

// Action Creators
export const createDecrementWaiting = (payload: {|+key: string|}) => ({error: false, payload, type: decrementWaiting})
export const createIncrementWaiting = (payload: {|+key: string|}) => ({error: false, payload, type: incrementWaiting})

// Action Payloads
export type DecrementWaitingPayload = More.ReturnType<typeof createDecrementWaiting>
export type IncrementWaitingPayload = More.ReturnType<typeof createIncrementWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDecrementWaiting>
  | More.ReturnType<typeof createIncrementWaiting>
  | {type: 'common:resetStore', payload: void}
