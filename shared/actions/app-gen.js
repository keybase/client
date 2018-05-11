// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of app but is handled by every reducer
export const changedActive = 'app:changedActive'
export const changedFocus = 'app:changedFocus'
export const dumpLogs = 'app:dumpLogs'
export const link = 'app:link'
export const mobileAppState = 'app:mobileAppState'
export const showMain = 'app:showMain'

// Payload Types
type _ChangedActivePayload = $ReadOnly<{|userActive: boolean|}>
type _ChangedFocusPayload = $ReadOnly<{|appFocused: boolean|}>
type _DumpLogsPayload = $ReadOnly<{|reason: 'quitting through menu'|}>
type _LinkPayload = $ReadOnly<{|link: string|}>
type _MobileAppStatePayload = $ReadOnly<{|nextAppState: 'active' | 'background' | 'inactive'|}>
type _ShowMainPayload = void

// Action Creators
export const createChangedActive = (payload: _ChangedActivePayload) => ({error: false, payload, type: changedActive})
export const createChangedFocus = (payload: _ChangedFocusPayload) => ({error: false, payload, type: changedFocus})
export const createDumpLogs = (payload: _DumpLogsPayload) => ({error: false, payload, type: dumpLogs})
export const createLink = (payload: _LinkPayload) => ({error: false, payload, type: link})
export const createMobileAppState = (payload: _MobileAppStatePayload) => ({error: false, payload, type: mobileAppState})
export const createShowMain = (payload: _ShowMainPayload) => ({error: false, payload, type: showMain})

// Action Payloads
export type ChangedActivePayload = $Call<typeof createChangedActive, _ChangedActivePayload>
export type ChangedFocusPayload = $Call<typeof createChangedFocus, _ChangedFocusPayload>
export type DumpLogsPayload = $Call<typeof createDumpLogs, _DumpLogsPayload>
export type LinkPayload = $Call<typeof createLink, _LinkPayload>
export type MobileAppStatePayload = $Call<typeof createMobileAppState, _MobileAppStatePayload>
export type ShowMainPayload = $Call<typeof createShowMain, _ShowMainPayload>

// All Actions
// prettier-ignore
export type Actions =
  | ChangedActivePayload
  | ChangedFocusPayload
  | DumpLogsPayload
  | LinkPayload
  | MobileAppStatePayload
  | ShowMainPayload
  | {type: 'common:resetStore', payload: void}
