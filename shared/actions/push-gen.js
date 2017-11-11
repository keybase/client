// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Constants from '../constants/push'

// Constants
export const resetStore = 'common:resetStore' // not a part of push but is handled by every reducer
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
export const updatePushToken = 'push:updatePushToken'

// Action Creators
export const createConfigurePush = () => ({error: false, payload: undefined, type: configurePush})
export const createError = (payload: {|+error: Error|}) => ({error: false, payload, type: error})
export const createNotification = (payload: {|+notification: Constants.PushNotification|}) => ({error: false, payload, type: notification})
export const createPermissionsNo = () => ({error: false, payload: undefined, type: permissionsNo})
export const createPermissionsPrompt = (payload: {|+prompt: boolean|}) => ({error: false, payload, type: permissionsPrompt})
export const createPermissionsRequest = () => ({error: false, payload: undefined, type: permissionsRequest})
export const createPermissionsRequesting = (payload: {|+requesting: boolean|}) => ({error: false, payload, type: permissionsRequesting})
export const createPushToken = (payload: {|+token: string, +tokenType: Constants.TokenType|}) => ({error: false, payload, type: pushToken})
export const createRegistrationError = (payload: {|+error: Error|}) => ({error: false, payload, type: registrationError})
export const createSavePushToken = () => ({error: false, payload: undefined, type: savePushToken})
export const createUpdatePushToken = (payload: {|+token: string, +tokenType: Constants.TokenType|}) => ({error: false, payload, type: updatePushToken})

// Action Payloads
export type ConfigurePushPayload = More.ReturnType<typeof createConfigurePush>
export type ErrorPayload = More.ReturnType<typeof createError>
export type NotificationPayload = More.ReturnType<typeof createNotification>
export type PermissionsNoPayload = More.ReturnType<typeof createPermissionsNo>
export type PermissionsPromptPayload = More.ReturnType<typeof createPermissionsPrompt>
export type PermissionsRequestPayload = More.ReturnType<typeof createPermissionsRequest>
export type PermissionsRequestingPayload = More.ReturnType<typeof createPermissionsRequesting>
export type PushTokenPayload = More.ReturnType<typeof createPushToken>
export type RegistrationErrorPayload = More.ReturnType<typeof createRegistrationError>
export type SavePushTokenPayload = More.ReturnType<typeof createSavePushToken>
export type UpdatePushTokenPayload = More.ReturnType<typeof createUpdatePushToken>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createConfigurePush>
  | More.ReturnType<typeof createError>
  | More.ReturnType<typeof createNotification>
  | More.ReturnType<typeof createPermissionsNo>
  | More.ReturnType<typeof createPermissionsPrompt>
  | More.ReturnType<typeof createPermissionsRequest>
  | More.ReturnType<typeof createPermissionsRequesting>
  | More.ReturnType<typeof createPushToken>
  | More.ReturnType<typeof createRegistrationError>
  | More.ReturnType<typeof createSavePushToken>
  | More.ReturnType<typeof createUpdatePushToken>
  | {type: 'common:resetStore', payload: void}
