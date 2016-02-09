/* @flow */

import * as Constants from '../constants/signup'
import SecureString from '../util/secure-string'

import type {SignupActions} from '../constants/signup'

export type SignupState = {
  inviteCode: ?string,
  username: ?string,
  email: ?string,
  inviteCodeError: ?string,
  usernameError: ?string,
  emailError: ?string,
  passphraseError: ?SecureString,
  passphrase: ?SecureString,
  phase: 'inviteCode' | 'usernameAndEmail' | 'deviceName' | 'paperkey' | 'passphraseSignup'
}

const initialState: SignupState = {
  inviteCode: null,
  username: null,
  email: null,
  inviteCodeError: null,
  usernameError: null,
  emailError: null,
  passphraseError: null,
  passphrase: null,
  phase: 'inviteCode'
}

export default function (state: SignupState = initialState, action: SignupActions): SignupState {
  switch (action.type) {
    case Constants.checkInviteCode:
      if (action.error) {
        return {
          ...state,
          inviteCodeError: action.payload.errorText
        }
      } else {
        return {
          ...state,
          inviteCode: action.payload.inviteCode,
          inviteCodeError: null,
          phase: 'usernameAndEmail'
        }
      }

    case Constants.checkUsernameEmail:
      const {username, email} = action.payload
      if (action.error) {
        const {emailError, usernameError} = action.payload
        return {
          ...state,
          emailError,
          usernameError,
          username,
          email
        }
      } else {
        return {
          ...state,
          phase: 'passphraseSignup',
          emailError: null,
          usernameError: null,
          username,
          email
        }
      }

    case Constants.checkPassphrase:
      if (action.error) {
        const {passphraseError} = action.payload
        return {
          ...state,
          passphraseError
        }
      } else {
        const {passphrase} = action.payload
        return {
          ...state,
          passphrase,
          passphraseError: null
        }
      }

    default:
      return state
  }
}
