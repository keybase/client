'use strict'

import * as Constants from '../constants/login2'
import Immutable from 'immutable'

const initialState = {
  username: '',
  passphrase: '',
  codePage: {
    otherDeviceRole: null,
    myDeviceRole: null,
    mode: null,
    cameraBrokenMode: false,
    codeCountDown: 0,
    textCode: null,
    qrScanned: null,
    qrCode: null
  },
  registerUserPassError: null,
  registerUserPassLoading: false,
  forgotPasswordEmailAddress: '',
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  forgotPasswordError: null
}

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.actionSubmitUserPass:
      return {
        ...state,
        username: action.username,
        passphrase: action.passphrase
      }
    case Constants.setCodeState: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          myDeviceRole: action.myDeviceRole,
          otherDeviceRole: action.otherDeviceRole
        }
      }).toJS()
    }
    case Constants.setCodeMode: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          mode: action.mode
        }
      }).toJS()
    }
    case Constants.setCountdown: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          codeCountDown: action.countDown
        }
      }).toJS()
    }
    case Constants.setTextCode: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          textCode: action.text
        }
      }).toJS()
    }
    case Constants.setQRCode: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          qrCode: action.qrCode
        }
      }).toJS()
    }
    case Constants.qrGenerated: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          qrCode: action.qrCode
        }
      }).toJS()
    }
    case Constants.qrScanned: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          qrScanned: action.code
        }
      }).toJS()
    }
    case Constants.actionRegisterUserPassSubmit:
      return {
        ...state,
        username: action.username,
        passphrase: action.passphrase,
        registerUserPassError: null,
        registerUserPassLoading: true
      }
    case Constants.actionRegisterUserPassDone:
      return {
        ...state,
        registerUserPassError: action.error,
        registerUserPassLoading: false
      }
    case Constants.actionUpdateForgotPasswordEmailAddress:
      return {
        ...state,
        forgotPasswordEmailAddress: action.email,
        forgotPasswordSuccess: false,
        forgotPasswordError: false
      }
    case Constants.actionSetForgotPasswordSubmitting:
      return {
        ...state,
        forgotPasswordSubmitting: true,
        forgotPasswordSuccess: false,
        forgotPasswordError: null
      }
    case Constants.actionForgotPasswordDone:
      return {
        ...state,
        forgotPasswordSubmitting: false,
        forgotPasswordSuccess: !action.error,
        forgotPasswordError: action.error
      }
    case Constants.cameraBrokenMode: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          cameraBrokenMode: action.broken
        }
      }).toJS()
    }
    case Constants.doneRegistering: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          otherDeviceRole: null,
          myDeviceRole: null,
          mode: null,
          cameraBrokenMode: false,
          codeCountDown: 0,
          textCode: null,
          qrScanned: null,
          qrCode: null
        }
      }).toJS()
    }
    default:
      return state
  }
}
