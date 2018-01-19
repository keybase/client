// @flow
import * as Types from './types/push'
import type {TypedState} from './reducer'
import {isIOS} from './platform'

export const tokenTypeApple: Types.TokenType = 'apple'
export const tokenTypeAppleDev: Types.TokenType = 'appledev'
export const tokenTypeAndroidPlay: Types.TokenType = 'androidplay'

export const androidSenderID = '9603251415'

export const initialState: Types.State = {
  checkOnStart: false,
  hasPermissions: false,
  permissionsPrompt: false,
  permissionsRequesting: false,
  tokenType: null,
  token: '',
}

export const showSettingsBadge = (state: TypedState) => {
  const TEMP = isIOS && (!state.push.token || !state.push.hasPermissions)
  console.log('aaaa', state.push.token, state.push.hasPermissions)
  return TEMP
}
