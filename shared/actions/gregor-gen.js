// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/gregor'
import * as RPCTypesGregor from '../constants/types/flow-types-gregor'

// Constants
export const resetStore = 'common:resetStore' // not a part of gregor but is handled by every reducer
export const checkReachability = 'gregor:checkReachability'
export const injectItem = 'gregor:injectItem'
export const pushOOBM = 'gregor:pushOOBM'
export const pushState = 'gregor:pushState'
export const updateReachability = 'gregor:updateReachability'
export const updateSeenMsgs = 'gregor:updateSeenMsgs'

// Action Creators
export const createCheckReachability = () => ({error: false, payload: undefined, type: checkReachability})
export const createInjectItem = (payload: {|+category: string, +body: string, +dtime?: ?Date|}) => ({error: false, payload, type: injectItem})
export const createPushOOBM = (payload: {|+messages: Array<RPCTypesGregor.OutOfBandMessage>|}) => ({error: false, payload, type: pushOOBM})
export const createPushState = (payload: {|+state: RPCTypesGregor.State, +reason: RPCTypes.PushReason|}) => ({error: false, payload, type: pushState})
export const createUpdateReachability = (payload: {|+reachability: RPCTypes.Reachability|}) => ({error: false, payload, type: updateReachability})
export const createUpdateSeenMsgs = (payload: {|+seenMsgs: Array<Types.NonNullGregorItem>|}) => ({error: false, payload, type: updateSeenMsgs})

// Action Payloads
export type CheckReachabilityPayload = More.ReturnType<typeof createCheckReachability>
export type InjectItemPayload = More.ReturnType<typeof createInjectItem>
export type PushOOBMPayload = More.ReturnType<typeof createPushOOBM>
export type PushStatePayload = More.ReturnType<typeof createPushState>
export type UpdateReachabilityPayload = More.ReturnType<typeof createUpdateReachability>
export type UpdateSeenMsgsPayload = More.ReturnType<typeof createUpdateSeenMsgs>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createCheckReachability>
  | More.ReturnType<typeof createInjectItem>
  | More.ReturnType<typeof createPushOOBM>
  | More.ReturnType<typeof createPushState>
  | More.ReturnType<typeof createUpdateReachability>
  | More.ReturnType<typeof createUpdateSeenMsgs>
  | {type: 'common:resetStore', payload: void}
