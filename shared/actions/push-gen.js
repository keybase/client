// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/push'

// Constants
export const resetStore = 'common:resetStore' // not a part of push but is handled by every reducer
export const checkIOSPush = 'push:checkIOSPush'
export const configurePush = 'push:configurePush'
export const error = 'push:error'
export const notification = 'push:notification'
export const permissionsNo = 'push:permissionsNo'
export const permissionsPrompt = 'push:permissionsPrompt'
export const permissionsRequest = 'push:permissionsRequest'
export const permissionsRequesting = 'push:permissionsRequesting'
export const pushToken = 'push:pushToken'
export const registrationError = 'push:registrationError'
export const savePushToken = 'push:savePushToken'
export const setHasPermissions = 'push:setHasPermissions'
export const updatePushToken = 'push:updatePushToken'

// Payload Types
type _CheckIOSPushPayload = void
type _ConfigurePushPayload = void
type _ErrorPayload = $ReadOnly<{|error: Error|}>
type _NotificationPayload = $ReadOnly<{|notification: Types.PushNotification|}>
type _PermissionsNoPayload = void
type _PermissionsPromptPayload = $ReadOnly<{|prompt: boolean|}>
type _PermissionsRequestPayload = void
type _PermissionsRequestingPayload = $ReadOnly<{|requesting: boolean|}>
type _PushTokenPayload = $ReadOnly<{|
  token: string,
  tokenType: Types.TokenType,
|}>
type _RegistrationErrorPayload = $ReadOnly<{|error: Error|}>
type _SavePushTokenPayload = void
type _SetHasPermissionsPayload = $ReadOnly<{|hasPermissions: boolean|}>
type _UpdatePushTokenPayload = $ReadOnly<{|
  token: string,
  tokenType: Types.TokenType,
|}>

// Action Creators
export const createCheckIOSPush = (payload: _CheckIOSPushPayload) => ({error: false, payload, type: checkIOSPush})
export const createConfigurePush = (payload: _ConfigurePushPayload) => ({error: false, payload, type: configurePush})
export const createError = (payload: _ErrorPayload) => ({error: false, payload, type: error})
export const createNotification = (payload: _NotificationPayload) => ({error: false, payload, type: notification})
export const createPermissionsNo = (payload: _PermissionsNoPayload) => ({error: false, payload, type: permissionsNo})
export const createPermissionsPrompt = (payload: _PermissionsPromptPayload) => ({error: false, payload, type: permissionsPrompt})
export const createPermissionsRequest = (payload: _PermissionsRequestPayload) => ({error: false, payload, type: permissionsRequest})
export const createPermissionsRequesting = (payload: _PermissionsRequestingPayload) => ({error: false, payload, type: permissionsRequesting})
export const createPushToken = (payload: _PushTokenPayload) => ({error: false, payload, type: pushToken})
export const createRegistrationError = (payload: _RegistrationErrorPayload) => ({error: false, payload, type: registrationError})
export const createSavePushToken = (payload: _SavePushTokenPayload) => ({error: false, payload, type: savePushToken})
export const createSetHasPermissions = (payload: _SetHasPermissionsPayload) => ({error: false, payload, type: setHasPermissions})
export const createUpdatePushToken = (payload: _UpdatePushTokenPayload) => ({error: false, payload, type: updatePushToken})

// Action Payloads
export type CheckIOSPushPayload = $Call<typeof createCheckIOSPush, _CheckIOSPushPayload>
export type ConfigurePushPayload = $Call<typeof createConfigurePush, _ConfigurePushPayload>
export type ErrorPayload = $Call<typeof createError, _ErrorPayload>
export type NotificationPayload = $Call<typeof createNotification, _NotificationPayload>
export type PermissionsNoPayload = $Call<typeof createPermissionsNo, _PermissionsNoPayload>
export type PermissionsPromptPayload = $Call<typeof createPermissionsPrompt, _PermissionsPromptPayload>
export type PermissionsRequestPayload = $Call<typeof createPermissionsRequest, _PermissionsRequestPayload>
export type PermissionsRequestingPayload = $Call<typeof createPermissionsRequesting, _PermissionsRequestingPayload>
export type PushTokenPayload = $Call<typeof createPushToken, _PushTokenPayload>
export type RegistrationErrorPayload = $Call<typeof createRegistrationError, _RegistrationErrorPayload>
export type SavePushTokenPayload = $Call<typeof createSavePushToken, _SavePushTokenPayload>
export type SetHasPermissionsPayload = $Call<typeof createSetHasPermissions, _SetHasPermissionsPayload>
export type UpdatePushTokenPayload = $Call<typeof createUpdatePushToken, _UpdatePushTokenPayload>

// All Actions
// prettier-ignore
export type Actions =
  | CheckIOSPushPayload
  | ConfigurePushPayload
  | ErrorPayload
  | NotificationPayload
  | PermissionsNoPayload
  | PermissionsPromptPayload
  | PermissionsRequestPayload
  | PermissionsRequestingPayload
  | PushTokenPayload
  | RegistrationErrorPayload
  | SavePushTokenPayload
  | SetHasPermissionsPayload
  | UpdatePushTokenPayload
  | {type: 'common:resetStore', payload: void}
