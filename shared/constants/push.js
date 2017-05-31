// @flow
import type {NoErrorTypedAction} from '../constants/types/flux'

export type TokenType = 'apple' | 'appledev' | 'androidplay'
export const tokenTypeApple: TokenType = 'apple'
export const tokenTypeAppleDev: TokenType = 'appledev'
export const tokenTypeAndroidPlay: TokenType = 'androidplay'

// FIXME: these types diverge because of react-native-push-notification. In the
// future it would be nice to make the Android push notification data structure
// resemble iOS more closely.
export type PushNotification = {
  payload?: {
    userInteraction: boolean,
    convID?: string, // Android variant
    type?: string,
    data?: {
      // iOS variant
      convID?: string,
    },
    username?: string,
  },
}

export const androidSenderID = '9603251415'

export const configurePush = 'push:configurePush'
export type ConfigurePush = NoErrorTypedAction<'push:configurePush', void>

export const permissionsRequest = 'push:permissionsRequest'
export type PushPermissionsRequest = NoErrorTypedAction<'push:permissionsRequest', void>

export const permissionsRequesting = 'push:permissionsRequesting'
export type PushPermissionsRequesting = NoErrorTypedAction<'push:permissionsRequesting', boolean>

export const permissionsPrompt = 'push:permissionsPrompt'
export type PushPermissionsPrompt = NoErrorTypedAction<'push:permissionsPrompt', boolean>

export const pushToken = 'push:pushToken'
export type PushToken = NoErrorTypedAction<'push:pushToken', {token: string, tokenType: TokenType}>

export const pushRegistrationError = 'push:registrationError'
export type PushRegistrationError = NoErrorTypedAction<'push:registrationError', {error: Error}>

export const pushError = 'push:error'
export type PushError = NoErrorTypedAction<'push:error', {error: Error}>

export const updatePushToken = 'push:updatePushToken'
export type UpdatePushToken = NoErrorTypedAction<
  'push:updatePushToken',
  {token: string, tokenType: TokenType}
>

export const savePushToken = 'push:savePushToken'
export type SavePushToken = NoErrorTypedAction<'push:savePushToken', void>

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
