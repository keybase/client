// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/push'

// Constants
export const resetStore = 'common:resetStore' // not a part of push but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'push:'
export const notification = 'push:notification'
export const rejectPermissions = 'push:rejectPermissions'
export const requestPermissions = 'push:requestPermissions'
export const showPermissionsPrompt = 'push:showPermissionsPrompt'
export const updateHasPermissions = 'push:updateHasPermissions'
export const updatePushToken = 'push:updatePushToken'

// Payload Types
type _NotificationPayload = $ReadOnly<{|notification: Types.PushNotification|}>
type _RejectPermissionsPayload = void
type _RequestPermissionsPayload = void
type _ShowPermissionsPromptPayload = $ReadOnly<{|show: boolean|}>
type _UpdateHasPermissionsPayload = $ReadOnly<{|hasPermissions: boolean|}>
type _UpdatePushTokenPayload = $ReadOnly<{|token: string|}>

// Action Creators
export const createNotification = (payload: _NotificationPayload) => ({error: false, payload, type: notification})
export const createRejectPermissions = (payload: _RejectPermissionsPayload) => ({error: false, payload, type: rejectPermissions})
export const createRequestPermissions = (payload: _RequestPermissionsPayload) => ({error: false, payload, type: requestPermissions})
export const createShowPermissionsPrompt = (payload: _ShowPermissionsPromptPayload) => ({error: false, payload, type: showPermissionsPrompt})
export const createUpdateHasPermissions = (payload: _UpdateHasPermissionsPayload) => ({error: false, payload, type: updateHasPermissions})
export const createUpdatePushToken = (payload: _UpdatePushTokenPayload) => ({error: false, payload, type: updatePushToken})

// Action Payloads
export type NotificationPayload = $Call<typeof createNotification, _NotificationPayload>
export type RejectPermissionsPayload = $Call<typeof createRejectPermissions, _RejectPermissionsPayload>
export type RequestPermissionsPayload = $Call<typeof createRequestPermissions, _RequestPermissionsPayload>
export type ShowPermissionsPromptPayload = $Call<typeof createShowPermissionsPrompt, _ShowPermissionsPromptPayload>
export type UpdateHasPermissionsPayload = $Call<typeof createUpdateHasPermissions, _UpdateHasPermissionsPayload>
export type UpdatePushTokenPayload = $Call<typeof createUpdatePushToken, _UpdatePushTokenPayload>

// All Actions
// prettier-ignore
export type Actions =
  | NotificationPayload
  | RejectPermissionsPayload
  | RequestPermissionsPayload
  | ShowPermissionsPromptPayload
  | UpdateHasPermissionsPayload
  | UpdatePushTokenPayload
  | {type: 'common:resetStore', payload: void}
