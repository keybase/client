/* @flow */
'use strict'

import * as Constants from '../constants/login2'
import * as ConfigConstants from '../constants/config'
import Immutable from 'immutable'
import {Platform} from 'react-native'
import {
  codePageDeviceRoleNewPhone,
  codePageDeviceRoleNewComputer,
  codePageDeviceRoleExistingPhone,
  codePageDeviceRoleExistingComputer} from '../constants/login2'

type DeviceRole = 'codePageDeviceRoleExistingPhone' | 'codePageDeviceRoleNewPhone' | 'codePageDeviceRoleExistingComputer' | 'codePageDeviceRoleNewComputer'

type Mode = 'codePageModeScanCode' | 'codePageModeShowCode' | 'codePageModeEnterText' | 'codePageModeShowText'

// It's the b64 encoded value used to render the image
type QRCode = string

type Error = string

type LoginState = {
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
  forgotPasswordError: ?Error,
  userPass: {
    username: string | '',
    passphrase: string | ''
  },
  deviceName: {
    onSubmit: ?Function,
    existingDevices: ?Array,
    deviceName: string | ''
  }
}

const initialState: LoginState = {
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
  forgotPasswordError: null,
  userPass: {
    username: '',
    passphrase: ''
  },
  deviceName: {
    onSubmit: () => {},
    existingDevices: [],
    deviceName: ''
  }
}

export default function (state: LoginState = initialState, action: any): LoginState {
  let toMerge = null

  switch (action.type) {
    case Constants.login:
      const {username, passphrase} = action
      toMerge = {userPass: {username, passphrase}}
      break
    case Constants.loginDone: {
      const {username} = action
      toMerge = {userPass: {username}}
      break
    }
    case ConfigConstants.startupLoaded:
      if (action.error) {
        return state
      }
      let myDeviceRole = null
      const isPhone = (Platform.OS === 'ios' || Platform.OS === 'android')

      if (action.payload.status.registered) {
        myDeviceRole = isPhone ? codePageDeviceRoleExistingPhone : codePageDeviceRoleExistingComputer
      } else {
        myDeviceRole = isPhone ? codePageDeviceRoleNewPhone : codePageDeviceRoleNewComputer
      }

      toMerge = {codePage: {myDeviceRole}}
      break
    case Constants.setOtherDeviceCodeState:
      toMerge = {codePage: {otherDeviceRole: action.otherDeviceRole}}
      break
    case Constants.setCodeMode:
      toMerge = {codePage: {mode: action.mode}}
      break
    case Constants.setCountdown:
      toMerge = {codePage: {codeCountDown: action.countDown}}
      break
    case Constants.setTextCode:
      toMerge = {codePage: {textCode: action.text}}
      break
    case Constants.setQRCode:
      toMerge = {codePage: {qrCode: action.qrCode}}
      break
    case Constants.qrGenerate:
      toMerge = {codePage: {qrCode: action.qrCode}}
      break
    case Constants.qrScanned:
      toMerge = {codePage: {qrScanned: action.code}}
      break
    case Constants.actionRegisterUserPassSubmit: {
      const {username, passphrase} = action
      toMerge = {
        serPass: {
          username,
          passphrase
        },
        registerUserPassError: null,
        registerUserPassLoading: true
      }
      break
    }
    case Constants.actionRegisterUserPassDone:
      toMerge = {
        registerUserPassError: action.error,
        registerUserPassLoading: false
      }
      break
    case Constants.actionUpdateForgotPasswordEmailAddress:
      toMerge = {
        forgotPasswordEmailAddress: action.email,
        forgotPasswordSuccess: false,
        forgotPasswordError: null
      }
      break
    case Constants.actionSetForgotPasswordSubmitting:
      toMerge = {
        forgotPasswordSubmitting: true,
        forgotPasswordSuccess: false,
        forgotPasswordError: null
      }
      break
    case Constants.actionForgotPasswordDone:
      toMerge = {
        forgotPasswordSubmitting: false,
        forgotPasswordSuccess: !action.error,
        forgotPasswordError: action.error
      }
      break
    case Constants.cameraBrokenMode:
      toMerge = {codePage: {cameraBrokenMode: action.broken}}
      break
    case Constants.doneRegistering: {
      toMerge = {
        codePage: {
          codeCountDown: 0,
          textCode: null,
          qrScanned: null,
          qrCode: null
        }
      }
      break
    }
    case Constants.actionAskUserPass:
      const {title, subTitle, onSubmit, hidePass} = action
      toMerge = {userPass: {title, subTitle, hidePass, onSubmit}}
      break
    case Constants.actionSetUserPass: {
      const {username, passphrase} = action
      toMerge = {userPass: {username, passphrase}}
      break
    }
    case Constants.actionAskDeviceName: {
      const {onSubmit, existingDevices} = action
      toMerge = {deviceName: {onSubmit, existingDevices}}
      break
    }
    case Constants.actionSetDeviceName:
      const {deviceName} = action
      toMerge = {deviceName: {deviceName}}
      break
    default:
      return state
  }

  const s = Immutable.fromJS(state)
  return s.mergeDeep(toMerge).toJS()
}
