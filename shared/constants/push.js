// @flow
import type {NoErrorTypedAction} from '../constants/types/flux'

export type TokenType = 'apple' | 'androidplay'
export const tokenTypeApple: TokenType = 'apple'
export const tokenTypeAndroidPlay: TokenType = 'androidplay'

// FIXME: these types diverge because of react-native-push-notification. In the
// future it would be nice to make the Android push notification data structure
// resemble iOS more closely.
export type PushNotification = {
  payload?: {
    userInteraction: boolean,
    convID?: string,  // Android variant
    data?: {  // iOS variant
      convID?: string,
    },
  },
}

export const androidSenderID = '9603251415'

export const configurePush = 'push:configurePush'
export type ConfigurePush = NoErrorTypedAction<'push:configurePush', void>

export const permissionsRequest = 'push:permissionsRequest'
export type PushPermissionsRequestAction = NoErrorTypedAction<'push:permissionsRequest', void>

export const permissionsRequesting = 'push:permissionsRequesting'
export type PushPermissionsRequestingAction = NoErrorTypedAction<'push:permissionsRequesting', boolean>

export const permissionsPrompt = 'push:permissionsPrompt'
export type PushPermissionsPromptAction = NoErrorTypedAction<'push:permissionsPrompt', boolean>

export const pushToken = 'push:pushToken'
export type PushTokenAction = NoErrorTypedAction<'push:pushToken', {token: string, tokenType: TokenType}>

export const pushRegistrationError = 'push:registrationError'
export type PushRegistrationError = NoErrorTypedAction<'push:registrationError', {error: Error}>

export const pushError = 'push:error'
export type PushError = NoErrorTypedAction<'push:error', {error: Error}>

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
