/* @flow */

import * as Constants from '../constants/signup'
import * as CommonConstants from '../constants/common'

import HiddenString from '../util/hidden-string'

import type {SignupActions} from '../constants/signup'

import {isMobile} from '../constants/platform'

export type SignupState = {
  inviteCode: ?string,
  username: ?string,
  email: ?string,
  inviteCodeError: ?string,
  usernameError: ?string,
  emailError: ?string,
  nameError: ?string,
  passphraseError: ?HiddenString,
  passphrase: ?HiddenString,
  deviceNameError: ?string,
  deviceName: ?string,
  paperkey: ?HiddenString,
  signupError: ?HiddenString,
  waiting: boolean,
  phase: 'inviteCode' | 'usernameAndEmail' | 'passphraseSignup' | 'deviceName' | 'signupLoading' | 'paperkey' | 'success' | 'signupError' | 'requestInvite' | 'requestInviteSuccess'
}

const initialState: SignupState = {
  inviteCode: null,
  username: null,
  email: null,
  inviteCodeError: null,
  usernameError: null,
  emailError: null,
  nameError: null,
  passphraseError: null,
  passphrase: null,
  deviceNameError: null,
  paperkey: null,
  signupError: null,
  deviceName: isMobile ? 'Mobile Device' : 'Home Computer',
  waiting: false,
  phase: 'inviteCode',
}

/* eslint-disable no-fallthrough */
export default function (state: SignupState = initialState, action: SignupActions): SignupState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.signupWaiting:
      if (action.error) {
        return state
      }
      return {...state, waiting: action.payload}

    case Constants.checkInviteCode:
      if (action.error) {
        return {
          ...state,
          inviteCodeError: action.payload.errorText,
        }
      } else {
        return {
          ...state,
          inviteCode: action.payload.inviteCode,
          inviteCodeError: null,
          phase: 'usernameAndEmail',
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
          email,
        }
      } else {
        return {
          ...state,
          phase: 'passphraseSignup',
          emailError: null,
          usernameError: null,
          username,
          email,
        }
      }

    case Constants.startRequestInvite:
      return {
        ...state,
        phase: 'requestInvite',
      }

    case Constants.requestInvite:
      if (action.error) {
        const {emailError, nameError, email, name} = action.payload
        return {
          ...state,
          emailError,
          nameError,
          email,
          name,
        }
      } else {
        const {email, name} = action.payload
        return {
          ...state,
          phase: 'requestInviteSuccess',
          email,
          name,
        }
      }

    case Constants.checkPassphrase:
      if (action.error) {
        const {passphraseError} = action.payload
        return {
          ...state,
          passphraseError,
        }
      } else {
        const {passphrase} = action.payload
        return {
          ...state,
          phase: 'deviceName',
          passphrase,
          passphraseError: null,
        }
      }

    case Constants.submitDeviceName:
      if (action.error) {
        const {deviceNameError} = action.payload
        return {
          ...state,
          deviceNameError,
        }
      } else {
        const {deviceName} = action.payload
        return {
          ...state,
          phase: 'signupLoading',
          deviceName,
          deviceNameError: null,
        }
      }

    case Constants.showPaperKey:
      if (action.error) {
        console.next('Should not get an error from showing paper key')
        return state
      } else {
        const {paperkey} = action.payload
        return {
          ...state,
          paperkey,
          phase: 'paperkey',
        }
      }

    case Constants.showSuccess:
      if (action.error) {
        console.next('Should not get an error from showing success')
        return state
      } else {
        return {
          ...state,
          phase: 'success',
        }
      }

    case Constants.signup:
      if (action.error) {
        return {
          ...state,
          signupError: action.payload.signupError,
          phase: 'signupError',
        }
      } else {
        return state
      }

    case Constants.resetSignup:
      return {
        ...state,
        phase: 'inviteCode',
      }

    default:
      return state
  }
}
/* eslint-enable no-fallthrough */
