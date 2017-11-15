// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of app but is handled by every reducer
export const changedActive = 'app:changedActive'
export const changedFocus = 'app:changedFocus'
export const link = 'app:link'
export const mobileAppState = 'app:mobileAppState'

// Action Creators
export const createChangedActive = (payload: {|+userActive: boolean|}) => ({error: false, payload, type: changedActive})
export const createChangedFocus = (payload: {|+appFocused: boolean|}) => ({error: false, payload, type: changedFocus})
export const createLink = (payload: {|+link: string|}) => ({error: false, payload, type: link})
export const createMobileAppState = (payload: {|+nextAppState: string|}) => ({error: false, payload, type: mobileAppState})

// Action Payloads
export type ChangedActivePayload = More.ReturnType<typeof createChangedActive>
export type ChangedFocusPayload = More.ReturnType<typeof createChangedFocus>
export type LinkPayload = More.ReturnType<typeof createLink>
export type MobileAppStatePayload = More.ReturnType<typeof createMobileAppState>

// Reducer type
// Skipped

// All Actions
// prettier-ignore
export type Actions = ChangedActivePayload | ChangedFocusPayload | LinkPayload | MobileAppStatePayload | {type: 'common:resetStore', payload: void}
