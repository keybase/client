/* @flow */
'use strict'

import * as Constants from '../constants/login2'
import * as ConfigConstants from '../constants/config'
import Immutable from 'immutable'
import { Platform } from 'react-native'
import {
  codePageDeviceRoleNewPhone,
  codePageDeviceRoleNewComputer,
  codePageDeviceRoleExistingPhone,
  codePageDeviceRoleExistingComputer } from '../constants/login2'

type DeviceRole = 'codePageDeviceRoleExistingPhone' | 'codePageDeviceRoleNewPhone' | 'codePageDeviceRoleExistingComputer' | 'codePageDeviceRoleNewComputer'

type Mode = 'codePageModeScanCode' | 'codePageModeShowCode' | 'codePageModeEnterText' | 'codePageModeShowText'

// TODO: What's the real type of this?
type QRCode = string

type Error = string

type LoginState = {
  username: string | '',
  passphrase: string | '',
  codePage: {
    otherDeviceRole: ?DeviceRole,
    myDeviceRole: ?DeviceRole,
    mode: ?Mode,
    cameraBrokenMode: boolean,
    codeCountDown: number,
    textCode: ?string,
    qrScanned: ?QRCode,
    qrCode: ?QRCode
  },
  registerUserPassError: ?Error,
  registerUserPassLoading: boolean,
  forgotPasswordEmailAddress: string | '',
  forgotPasswordSubmitting: boolean,
  forgotPasswordSuccess: boolean,
  forgotPasswordError: ?Error
}

const initialState: LoginState = {
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

export default function (state: LoginState = initialState, action: any): LoginState {
  switch (action.type) {
    case Constants.login:
      return {
        ...state,
        username: action.username,
        passphrase: action.passphrase
      }
    case Constants.loginDone:
      return {
        ...state,
        username: action.username
      }
    case ConfigConstants.startupLoaded:
      if (!action.error) {
        let myDeviceRole = null
        const isPhone = (Platform.OS === 'ios' || Platform.OS === 'android')

        if (action.payload.status.registered) {
          myDeviceRole = isPhone ? codePageDeviceRoleExistingPhone : codePageDeviceRoleExistingComputer
        } else {
          myDeviceRole = isPhone ? codePageDeviceRoleNewPhone : codePageDeviceRoleNewComputer
        }

        const s = Immutable.fromJS(state)
        return s.mergeDeep({
          codePage: {
            myDeviceRole
          }
        }).toJS()
      }

      return state
    case Constants.setOtherDeviceCodeState: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
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
    case Constants.qrGenerate: {
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
        forgotPasswordError: null
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
