// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/dev'

// Constants
export const resetStore = 'common:resetStore' // not a part of dev but is handled by every reducer
export const debugCount = 'dev:debugCount'
export const updateDebugConfig = 'dev:updateDebugConfig'

// Action Creators
export const createDebugCount = () => ({error: false, payload: undefined, type: debugCount})
export const createUpdateDebugConfig = (
  payload: $ReadOnly<{
    dumbFilter: string,
    dumbFullscreen: boolean,
    dumbIndex: number,
  }>
) => ({error: false, payload, type: updateDebugConfig})

// Action Payloads
export type DebugCountPayload = More.ReturnType<typeof createDebugCount>
export type UpdateDebugConfigPayload = More.ReturnType<typeof createUpdateDebugConfig>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDebugCount>
  | More.ReturnType<typeof createUpdateDebugConfig>
  | {type: 'common:resetStore', payload: void}
