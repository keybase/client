// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/dev'

// Constants
export const resetStore = 'common:resetStore' // not a part of dev but is handled by every reducer
export const debugCount = 'dev:debugCount'
export const updateDebugConfig = 'dev:updateDebugConfig'
export const updatehmrReloading = 'dev:updatehmrReloading'

// Action Creators
export const createDebugCount = () => ({error: false, payload: undefined, type: debugCount})
export const createUpdateDebugConfig = (payload: {|+config: Types.DebugConfig|}) => ({error: false, payload, type: updateDebugConfig})
export const createUpdatehmrReloading = (payload: {|+reloading: boolean|}) => ({error: false, payload, type: updatehmrReloading})

// Action Payloads
export type DebugCountPayload = More.ReturnType<typeof createDebugCount>
export type UpdateDebugConfigPayload = More.ReturnType<typeof createUpdateDebugConfig>
export type UpdatehmrReloadingPayload = More.ReturnType<typeof createUpdatehmrReloading>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDebugCount>
  | More.ReturnType<typeof createUpdateDebugConfig>
  | More.ReturnType<typeof createUpdatehmrReloading>
  | {type: 'common:resetStore', payload: void}
