// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
type _NotificationPayload = {readonly notification: Types.PushNotification}
type _RejectPermissionsPayload = void
type _RequestPermissionsPayload = void
type _ShowPermissionsPromptPayload = {readonly show: boolean}
type _UpdateHasPermissionsPayload = {readonly hasPermissions: boolean}
type _UpdatePushTokenPayload = {readonly token: string}

// Action Creators
export const createNotification = (payload: _NotificationPayload): NotificationPayload => ({
  payload,
  type: notification,
})
export const createRejectPermissions = (payload: _RejectPermissionsPayload): RejectPermissionsPayload => ({
  payload,
  type: rejectPermissions,
})
export const createRequestPermissions = (payload: _RequestPermissionsPayload): RequestPermissionsPayload => ({
  payload,
  type: requestPermissions,
})
export const createShowPermissionsPrompt = (
  payload: _ShowPermissionsPromptPayload
): ShowPermissionsPromptPayload => ({payload, type: showPermissionsPrompt})
export const createUpdateHasPermissions = (
  payload: _UpdateHasPermissionsPayload
): UpdateHasPermissionsPayload => ({payload, type: updateHasPermissions})
export const createUpdatePushToken = (payload: _UpdatePushTokenPayload): UpdatePushTokenPayload => ({
  payload,
  type: updatePushToken,
})

// Action Payloads
export type NotificationPayload = {readonly payload: _NotificationPayload; readonly type: 'push:notification'}
export type RejectPermissionsPayload = {
  readonly payload: _RejectPermissionsPayload
  readonly type: 'push:rejectPermissions'
}
export type RequestPermissionsPayload = {
  readonly payload: _RequestPermissionsPayload
  readonly type: 'push:requestPermissions'
}
export type ShowPermissionsPromptPayload = {
  readonly payload: _ShowPermissionsPromptPayload
  readonly type: 'push:showPermissionsPrompt'
}
export type UpdateHasPermissionsPayload = {
  readonly payload: _UpdateHasPermissionsPayload
  readonly type: 'push:updateHasPermissions'
}
export type UpdatePushTokenPayload = {
  readonly payload: _UpdatePushTokenPayload
  readonly type: 'push:updatePushToken'
}

// All Actions
// prettier-ignore
export type Actions =
  | NotificationPayload
  | RejectPermissionsPayload
  | RequestPermissionsPayload
  | ShowPermissionsPromptPayload
  | UpdateHasPermissionsPayload
  | UpdatePushTokenPayload
  | {type: 'common:resetStore', payload: null}
