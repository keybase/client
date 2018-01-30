// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of users but is handled by every reducer
export const updateBrokenState = 'users:updateBrokenState'

// Action Creators
export const createUpdateBrokenState = (
  payload: $ReadOnly<{
    newlyBroken: Array<string>,
    newlyFixed: Array<string>,
  }>
) => ({error: false, payload, type: updateBrokenState})

// Action Payloads
export type UpdateBrokenStatePayload = More.ReturnType<typeof createUpdateBrokenState>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createUpdateBrokenState>
  | {type: 'common:resetStore', payload: void}
