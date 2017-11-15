// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/devices'

// Constants
export const resetStore = 'common:resetStore' // not a part of devices but is handled by every reducer
export const load = 'devices:load'
export const loaded = 'devices:loaded'
export const paperKeyMake = 'devices:paperKeyMake'
export const revoke = 'devices:revoke'
export const setWaiting = 'devices:setWaiting'
export const showRevokePage = 'devices:showRevokePage'

// Action Creators
export const createLoad = () => ({error: false, payload: undefined, type: load})
export const createLoaded = (payload: {|+deviceIDs: Array<string>|}) => ({error: false, payload, type: loaded})
export const createPaperKeyMake = () => ({error: false, payload: undefined, type: paperKeyMake})
export const createRevoke = (payload: {|+deviceID: string|}) => ({error: false, payload, type: revoke})
export const createSetWaiting = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: setWaiting})
export const createShowRevokePage = (payload: {|+deviceID: string|}) => ({error: false, payload, type: showRevokePage})

// Action Payloads
export type LoadPayload = More.ReturnType<typeof createLoad>
export type LoadedPayload = More.ReturnType<typeof createLoaded>
export type PaperKeyMakePayload = More.ReturnType<typeof createPaperKeyMake>
export type RevokePayload = More.ReturnType<typeof createRevoke>
export type SetWaitingPayload = More.ReturnType<typeof createSetWaiting>
export type ShowRevokePagePayload = More.ReturnType<typeof createShowRevokePage>

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'devices:load': (state: Types.State, action: LoadPayload) => Types.State, 'devices:loaded': (state: Types.State, action: LoadedPayload) => Types.State, 'devices:paperKeyMake': (state: Types.State, action: PaperKeyMakePayload) => Types.State, 'devices:revoke': (state: Types.State, action: RevokePayload) => Types.State, 'devices:setWaiting': (state: Types.State, action: SetWaitingPayload) => Types.State, 'devices:showRevokePage': (state: Types.State, action: ShowRevokePagePayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = LoadPayload | LoadedPayload | PaperKeyMakePayload | RevokePayload | SetWaitingPayload | ShowRevokePagePayload | {type: 'common:resetStore', payload: void}
