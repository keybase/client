// @flow
import type {NoErrorTypedAction} from '../constants/types/flux'

export const tokenTypeApple = 'apple'
export const tokenTypeAndroidPlay = 'androidplay'
export type TokenType = 'apple' | 'androidplay'

export type PushNotification = {
  message: string,
}

export const permissionsRequest = 'push:permissionsRequest'
export type PushPermissionsRequestAction = NoErrorTypedAction<'push:permissionsRequest', void>

export const permissionsRequesting = 'push:permissionsRequesting'
export type PushPermissionsRequestingAction = NoErrorTypedAction<'push:permissionsRequesting', boolean>

export const permissionsPrompt = 'push:permissionsPrompt'
export type PushPermissionsPromptAction = NoErrorTypedAction<'push:permissionsPrompt', boolean>

export const pushToken = 'push:pushToken'
export type PushTokenAction = NoErrorTypedAction<'push:pushToken', {token: string, tokenType: TokenType}>

export const updatePushToken = 'push:updatePushToken'
export type UpdatePushTokenAction = NoErrorTypedAction<'push:updatePushToken', {token: string, tokenType: TokenType}>

export const savePushToken = 'push:savePushToken'
export type SavePushTokenAction = NoErrorTypedAction<'push:savePushToken', void>

export const pushNotification = 'push:notification'
export type PushNotificationAction = NoErrorTypedAction<'push:notification', PushNotification>

export type State = {
  token: string,
  tokenType: ?TokenType,
  permissionsRequesting: boolean,
  permissionsPrompt: boolean,
}

export const initialState: State = {
  permissionsPrompt: false,
  permissionsRequesting: false,
  tokenType: null,
  token: '',
}
