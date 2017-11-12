// @flow
/* eslint-disable */

// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {type PayloadType, type ReturnType} from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of waiting but is handled by every reducer
export const decrementWaiting = 'waiting:decrementWaiting'
export const incrementWaiting = 'waiting:incrementWaiting'

// Action Creators
export const createDecrementWaiting = (payload: {|key: string|}) => ({error: false, payload, type: decrementWaiting})
export const createIncrementWaiting = (payload: {|key: string|}) => ({error: false, payload, type: incrementWaiting})

// Action Payloads
export type DecrementWaitingPayload = ReturnType<typeof createDecrementWaiting>
export type IncrementWaitingPayload = ReturnType<typeof createIncrementWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createDecrementWaiting>
  | ReturnType<typeof createIncrementWaiting>
  | {type: 'common:resetStore', payload: void}
