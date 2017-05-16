// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/signup'
import {isMobile} from '../constants/platform'

const initialState: Constants.State = {
  deviceName: isMobile ? 'Mobile Device' : 'Home Computer',
  deviceNameError: null,
  email: null,
  emailError: null,
  inviteCode: null,
  inviteCodeError: null,
  nameError: null,
  paperkey: null,
  passphrase: null,
  passphraseError: null,
  phase: 'inviteCode',
  signupError: null,
  username: null,
  usernameError: null,
  waiting: false,
}

/* eslint-disable no-fallthrough */
export default function(state: Constants.State = initialState, action: Constants.Actions): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
    case Constants.resetSignup: // fallthrough
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
          email,
          emailError,
          username,
          usernameError,
        }
      } else {
        return {
          ...state,
          email,
          emailError: null,
          phase: 'passphraseSignup',
          username,
          usernameError: null,
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
          email,
          emailError,
          name,
          nameError,
        }
      } else {
        const {email, name} = action.payload
        return {
          ...state,
          email,
          name,
          phase: 'requestInviteSuccess',
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
          passphrase,
          passphraseError: null,
          phase: 'deviceName',
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
          deviceName,
          deviceNameError: null,
          phase: 'signupLoading',
        }
      }

    case Constants.showPaperKey:
      if (action.error) {
        console.warn('Should not get an error from showing paper key')
        return state
      } else {
        const {paperkey} = action.payload
        return {
          ...state,
          paperkey,
          phase: 'success',
        }
      }

    case Constants.showSuccess:
      if (action.error) {
        console.warn('Should not get an error from showing success')
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
          phase: 'signupError',
          signupError: action.payload.signupError,
        }
      } else {
        return state
      }

    case Constants.restartSignup:
      return {
        ...state,
        inviteCodeError: null,
        passphraseError: null,
        phase: 'inviteCode',
      }

    default:
      return state
  }
}
/* eslint-enable no-fallthrough */
