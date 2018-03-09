// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of users but is handled by every reducer
export const updateBrokenState = 'users:updateBrokenState'
export const updateFullnames = 'users:updateFullnames'

// Action Creators
export const createUpdateBrokenState = (
  payload: $ReadOnly<{
    newlyBroken: Array<string>,
    newlyFixed: Array<string>,
  }>
) => ({error: false, payload, type: updateBrokenState})
export const createUpdateFullnames = (payload: $ReadOnly<{usernameToFullname: {[username: string]: string}}>) => ({error: false, payload, type: updateFullnames})

// Action Payloads
export type UpdateBrokenStatePayload = More.ReturnType<typeof createUpdateBrokenState>
export type UpdateFullnamesPayload = More.ReturnType<typeof createUpdateFullnames>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createUpdateBrokenState>
  | More.ReturnType<typeof createUpdateFullnames>
  | {type: 'common:resetStore', payload: void}
