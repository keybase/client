// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Constants from '../constants/devices'

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

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createLoad>
  | More.ReturnType<typeof createLoaded>
  | More.ReturnType<typeof createPaperKeyMake>
  | More.ReturnType<typeof createRevoke>
  | More.ReturnType<typeof createSetWaiting>
  | More.ReturnType<typeof createShowRevokePage>
  | {type: 'common:resetStore', payload: void}
