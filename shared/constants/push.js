// @flow
import type {NoErrorTypedAction, TypedAction} from '../constants/types/flux'

export const permissionsRequest = 'push:permissionsRequest'
export type PushPermissionsRequest = NoErrorTypedAction<'push:permissionsRequest', void>

export const permissionsRequesting = 'push:permissionsRequesting'
export type PushPermissionsRequesting = NoErrorTypedAction<'push:permissionsRequesting', boolean>

export const permissionsPrompt = 'push:permissionsPrompt'
export type PushPermissionsPrompt = NoErrorTypedAction<'push:permissionsPrompt', boolean>

export type TokenType = '' | 'ios' | 'android'

export const pushToken = 'push:pushToken'
export type PushToken = NoErrorTypedAction<'push:pushToken', {token: string, tokenType: TokenType}>

export const updatePushToken = 'push:updatePushToken'
export type UpdatePushToken = NoErrorTypedAction<'push:updatePushToken', {token: string, tokenType: TokenType}>

export const savePushToken = 'push:savePushToken'
export type SavePushToken = NoErrorTypedAction<'push:savePushToken', void>

export type State = {
  token: string,
  tokenType: string,
  permissionsRequesting: boolean,
  permissionsPrompt: boolean,
}

export const initialState: State = {
  permissionsPrompt: false,
  permissionsRequesting: false,
  tokenType: '',
  token: '',
}
