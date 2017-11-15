// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/dev'

// Constants
const resetStore = 'common:resetStore' // not a part of dev but is handled by every reducer
const debugCount = 'dev:debugCount'
const updateDebugConfig = 'dev:updateDebugConfig'
const updatehmrReloading = 'dev:updatehmrReloading'

// Action Creators
export const createDebugCount = () => ({error: false, payload: undefined, type: debugCount})
export const createUpdateDebugConfig = (payload: {|+config: Types.DebugConfig|}) => ({error: false, payload, type: updateDebugConfig})
export const createUpdatehmrReloading = (payload: {|+reloading: boolean|}) => ({error: false, payload, type: updatehmrReloading})

// Action Payloads
export type DebugCountPayload = More.ReturnType<typeof createDebugCount>
export type UpdateDebugConfigPayload = More.ReturnType<typeof createUpdateDebugConfig>
export type UpdatehmrReloadingPayload = More.ReturnType<typeof createUpdatehmrReloading>

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'dev:debugCount': (state: Types.State, action: DebugCountPayload) => Types.State, 'dev:updateDebugConfig': (state: Types.State, action: UpdateDebugConfigPayload) => Types.State, 'dev:updatehmrReloading': (state: Types.State, action: UpdatehmrReloadingPayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = DebugCountPayload | UpdateDebugConfigPayload | UpdatehmrReloadingPayload | {type: 'common:resetStore', payload: void}
