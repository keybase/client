/* @flow */

import * as Constants from '../constants/signup'
import * as CommonConstants from '../constants/common'

import HiddenString from '../util/hidden-string'

import type {SignupActions} from '../constants/signup'

export type SignupState = {
  inviteCode: ?string,
  username: ?string,
  email: ?string,
  inviteCodeError: ?string,
  usernameError: ?string,
  emailError: ?string,
  passphraseError: ?HiddenString,
  passphrase: ?HiddenString,
  deviceNameError: ?string,
  deviceName: ?string,
  paperkey: ?HiddenString,
  signupError: ?HiddenString,
  phase: 'inviteCode' | 'usernameAndEmail' | 'passphraseSignup' | 'deviceName' | 'signupLoading' | 'paperkey' | 'success' | 'signupError'
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
  deviceNameError: null,
  paperkey: null,
  signupError: null,
  deviceName: 'Home Computer',
  phase: 'inviteCode'
}

/* eslint-disable no-fallthrough */
export default function (state: SignupState = initialState, action: SignupActions): SignupState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return initialState

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
          phase: 'deviceName',
          passphrase,
          passphraseError: null
        }
      }

    case Constants.submitDeviceName:
      if (action.error) {
        const {deviceNameError} = action.payload
        return {
          ...state,
          deviceNameError
        }
      } else {
        const {deviceName} = action.payload
        return {
          ...state,
          phase: 'signupLoading',
          deviceName,
          deviceNameError: null
        }
      }

    case Constants.showPaperKey:
      if (action.error) {
        console.error('Should not get an error from showing paper key')
        return state
      } else {
        const {paperkey} = action.payload
        return {
          ...state,
          paperkey,
          phase: 'paperkey'
        }
      }

    case Constants.showSuccess:
      if (action.error) {
        console.error('Should not get an error from showing success')
        return state
      } else {
        return {
          ...state,
          phase: 'success'
        }
      }

    case Constants.signup:
      if (action.error) {
        return {
          ...state,
          signupError: action.payload.signupError,
          phase: 'signupError'
        }
      } else {
        return state
      }

    case Constants.resetSignup:
      return {
        ...state,
        phase: 'inviteCode'
      }

    default:
      return state
  }
}
/* eslint-enable no-fallthrough */
