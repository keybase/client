// @flow
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
type _NotificationPayload = $ReadOnly<{|notification: Types.PushNotification|}>
type _RejectPermissionsPayload = void
type _RequestPermissionsPayload = void
type _ShowPermissionsPromptPayload = $ReadOnly<{|show: boolean|}>
type _UpdateHasPermissionsPayload = $ReadOnly<{|hasPermissions: boolean|}>
type _UpdatePushTokenPayload = $ReadOnly<{|token: string|}>

// Action Creators
export const createNotification = (payload: _NotificationPayload) => ({payload, type: notification})
export const createRejectPermissions = (payload: _RejectPermissionsPayload) => ({payload, type: rejectPermissions})
export const createRequestPermissions = (payload: _RequestPermissionsPayload) => ({payload, type: requestPermissions})
export const createShowPermissionsPrompt = (payload: _ShowPermissionsPromptPayload) => ({payload, type: showPermissionsPrompt})
export const createUpdateHasPermissions = (payload: _UpdateHasPermissionsPayload) => ({payload, type: updateHasPermissions})
export const createUpdatePushToken = (payload: _UpdatePushTokenPayload) => ({payload, type: updatePushToken})

// Action Payloads
export type NotificationPayload = {|+payload: _NotificationPayload, +type: 'push:notification'|}
export type RejectPermissionsPayload = {|+payload: _RejectPermissionsPayload, +type: 'push:rejectPermissions'|}
export type RequestPermissionsPayload = {|+payload: _RequestPermissionsPayload, +type: 'push:requestPermissions'|}
export type ShowPermissionsPromptPayload = {|+payload: _ShowPermissionsPromptPayload, +type: 'push:showPermissionsPrompt'|}
export type UpdateHasPermissionsPayload = {|+payload: _UpdateHasPermissionsPayload, +type: 'push:updateHasPermissions'|}
export type UpdatePushTokenPayload = {|+payload: _UpdatePushTokenPayload, +type: 'push:updatePushToken'|}

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
