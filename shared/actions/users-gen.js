// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of users but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'users:'
export const updateBrokenState = 'users:updateBrokenState'
export const updateFullnames = 'users:updateFullnames'

// Payload Types
type _UpdateBrokenStatePayload = $ReadOnly<{|newlyBroken: Array<string>, newlyFixed: Array<string>|}>
type _UpdateFullnamesPayload = $ReadOnly<{|usernameToFullname: {[username: string]: string}|}>

// Action Creators
export const createUpdateBrokenState = (payload: _UpdateBrokenStatePayload) => ({payload, type: updateBrokenState})
export const createUpdateFullnames = (payload: _UpdateFullnamesPayload) => ({payload, type: updateFullnames})

// Action Payloads
export type UpdateBrokenStatePayload = {|+payload: _UpdateBrokenStatePayload, +type: 'users:updateBrokenState'|}
export type UpdateFullnamesPayload = {|+payload: _UpdateFullnamesPayload, +type: 'users:updateFullnames'|}

// All Actions
// prettier-ignore
export type Actions =
  | UpdateBrokenStatePayload
  | UpdateFullnamesPayload
  | {type: 'common:resetStore', payload: null}
