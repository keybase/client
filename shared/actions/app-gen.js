// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of app but is handled by every reducer
export const changedActive = 'app:changedActive'
export const changedFocus = 'app:changedFocus'
export const link = 'app:link'
export const mobileAppState = 'app:mobileAppState'
export const showMain = 'app:showMain'

// Action Creators
export const createChangedActive = (payload: $ReadOnly<{userActive: boolean}>) => ({error: false, payload, type: changedActive})
export const createChangedFocus = (payload: $ReadOnly<{appFocused: boolean}>) => ({error: false, payload, type: changedFocus})
export const createLink = (payload: $ReadOnly<{link: string}>) => ({error: false, payload, type: link})
export const createMobileAppState = (payload: $ReadOnly<{nextAppState: 'active' | 'background' | 'inactive'}>) => ({error: false, payload, type: mobileAppState})
export const createShowMain = () => ({error: false, payload: undefined, type: showMain})

// Action Payloads
export type ChangedActivePayload = More.ReturnType<typeof createChangedActive>
export type ChangedFocusPayload = More.ReturnType<typeof createChangedFocus>
export type LinkPayload = More.ReturnType<typeof createLink>
export type MobileAppStatePayload = More.ReturnType<typeof createMobileAppState>
export type ShowMainPayload = More.ReturnType<typeof createShowMain>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createChangedActive>
  | More.ReturnType<typeof createChangedFocus>
  | More.ReturnType<typeof createLink>
  | More.ReturnType<typeof createMobileAppState>
  | More.ReturnType<typeof createShowMain>
  | {type: 'common:resetStore', payload: void}
