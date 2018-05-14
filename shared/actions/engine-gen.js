// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of engine but is handled by every reducer
export const waitingForRpc = 'engine:waitingForRpc'

// Payload Types
type _WaitingForRpcPayload = $ReadOnly<{|
  waiting: boolean,
  name: string,
|}>

// Action Creators
export const createWaitingForRpc = (payload: _WaitingForRpcPayload) => ({error: false, payload, type: waitingForRpc})

// Action Payloads
export type WaitingForRpcPayload = $Call<typeof createWaitingForRpc, _WaitingForRpcPayload>

// All Actions
// prettier-ignore
export type Actions =
  | WaitingForRpcPayload
  | {type: 'common:resetStore', payload: void}
