// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of engine but is handled by every reducer
export const waitingForRpc = 'engine:waitingForRpc'

// Action Creators
export const createWaitingForRpc = (
  payload: $ReadOnly<{
    waiting: boolean,
    name: string,
  }>
) => ({error: false, payload, type: waitingForRpc})

// Action Payloads
export type WaitingForRpcPayload = More.ReturnType<typeof createWaitingForRpc>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createWaitingForRpc>
  | {type: 'common:resetStore', payload: void}
