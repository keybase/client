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

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'gregor:checkReachability': (state: Types.State, action: CheckReachabilityPayload) => Types.State, 'gregor:injectItem': (state: Types.State, action: InjectItemPayload) => Types.State, 'gregor:pushOOBM': (state: Types.State, action: PushOOBMPayload) => Types.State, 'gregor:pushState': (state: Types.State, action: PushStatePayload) => Types.State, 'gregor:updateReachability': (state: Types.State, action: UpdateReachabilityPayload) => Types.State, 'gregor:updateSeenMsgs': (state: Types.State, action: UpdateSeenMsgsPayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = CheckReachabilityPayload | InjectItemPayload | PushOOBMPayload | PushStatePayload | UpdateReachabilityPayload | UpdateSeenMsgsPayload | {type: 'common:resetStore', payload: void}
