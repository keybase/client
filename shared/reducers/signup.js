/* @flow */

import * as Constants from '../constants/signup'

import type {SignupActions, CheckInviteCode} from '../constants/signup'

export type SignupState = {
  inviteCode: ?string,
  username: ?string,
  email: ?string,
  inviteCodeError: ?string,
  usernameError: ?string,
  emailError: ?string,
  passwordError: ?string,
  phase: 'inviteCode' | 'usernameAndEmail' | 'passphrase' | 'deviceName' | 'paperkey'
}

const initialState: SignupState = {
  inviteCode: null,
  username: null,
  email: null,
  inviteCodeError: null,
  usernameError: null,
  emailError: null,
  passwordError: null,
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
          phase: 'passphrase',
          emailError: null,
          usernameError: null,
          username,
          email
        }
      }

    default:
      return state
  }
}
