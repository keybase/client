// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/engine'

// Constants
export const resetStore = 'common:resetStore' // not a part of engine but is handled by every reducer
export const errorInRpc = 'engine:errorInRpc'
export const waitingForRpc = 'engine:waitingForRpc'

// Action Creators
export const createErrorInRpc = (payload: {|+error: Error|}) => ({error: false, payload, type: errorInRpc})
export const createWaitingForRpc = (payload: {|+waiting: boolean, +name: string|}) => ({error: false, payload, type: waitingForRpc})

// Action Payloads
export type ErrorInRpcPayload = More.ReturnType<typeof createErrorInRpc>
export type WaitingForRpcPayload = More.ReturnType<typeof createWaitingForRpc>

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'engine:errorInRpc': (state: Types.State, action: ErrorInRpcPayload) => Types.State, 'engine:waitingForRpc': (state: Types.State, action: WaitingForRpcPayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = ErrorInRpcPayload | WaitingForRpcPayload | {type: 'common:resetStore', payload: void}
