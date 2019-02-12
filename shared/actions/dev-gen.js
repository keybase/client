// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/dev'

// Constants
export const resetStore = 'common:resetStore' // not a part of dev but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'dev:'
export const debugCount = 'dev:debugCount'
export const updateDebugConfig = 'dev:updateDebugConfig'

// Payload Types
type _DebugCountPayload = void
type _UpdateDebugConfigPayload = $ReadOnly<{|dumbFilter: string, dumbFullscreen: boolean, dumbIndex: number|}>

// Action Creators
export const createDebugCount = (payload: _DebugCountPayload) => ({payload, type: debugCount})
export const createUpdateDebugConfig = (payload: _UpdateDebugConfigPayload) => ({payload, type: updateDebugConfig})

// Action Payloads
export type DebugCountPayload = {|+payload: _DebugCountPayload, +type: 'dev:debugCount'|}
export type UpdateDebugConfigPayload = {|+payload: _UpdateDebugConfigPayload, +type: 'dev:updateDebugConfig'|}

// All Actions
// prettier-ignore
export type Actions =
  | DebugCountPayload
  | UpdateDebugConfigPayload
  | {type: 'common:resetStore', payload: null}
