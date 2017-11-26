// @flow
import * as Types from './types/push'

export const tokenTypeApple: Types.TokenType = 'apple'
export const tokenTypeAppleDev: Types.TokenType = 'appledev'
export const tokenTypeAndroidPlay: Types.TokenType = 'androidplay'

export const androidSenderID = '9603251415'

export const initialState: Types.State = {
  permissionsPrompt: false,
  permissionsRequesting: false,
  tokenType: null,
  token: '',
}
