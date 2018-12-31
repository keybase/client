// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/profile2'

// Constants
export const resetStore = 'common:resetStore' // not a part of profile2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'profile2:'
export const load = 'profile2:load'

// Payload Types
type _LoadPayload = $ReadOnly<{|assertion: string, forceDisplay: boolean, guiID: string, ignoreCache?: boolean, reason: string|}>

// Action Creators
export const createLoad = (payload: _LoadPayload) => ({payload, type: load})

// Action Payloads
export type LoadPayload = {|+payload: _LoadPayload, +type: 'profile2:load'|}

// All Actions
// prettier-ignore
export type Actions =
  | LoadPayload
  | {type: 'common:resetStore', payload: null}
