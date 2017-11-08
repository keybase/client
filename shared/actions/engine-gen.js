// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import {type ReturnType} from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of engine but is handled by every reducer
export const errorInRpc = 'engine:errorInRpc'
export const waitingForRpc = 'engine:waitingForRpc'

// Action Creators
export const createErrorInRpc = (payload: {|error: Error|}) => ({error: false, payload, type: errorInRpc})
export const createWaitingForRpc = (payload: {|waiting: boolean, name: string|}) => ({error: false, payload, type: waitingForRpc})

// Action Payloads
export type ErrorInRpcPayload = ReturnType<typeof createErrorInRpc>
export type WaitingForRpcPayload = ReturnType<typeof createWaitingForRpc>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createErrorInRpc>
  | ReturnType<typeof createWaitingForRpc>
  | {type: 'common:resetStore', payload: void}
