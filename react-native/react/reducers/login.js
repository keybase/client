/* @flow */

import * as Constants from '../constants/login'
import * as ConfigConstants from '../constants/config'
import Immutable from 'immutable'
import {isMobile} from '../constants/platform'
import {
  codePageDeviceRoleNewPhone,
  codePageDeviceRoleNewComputer,
  codePageDeviceRoleExistingPhone,
  codePageDeviceRoleExistingComputer} from '../constants/login'

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
    existingDevices: ?Array<string>,
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
    case ConfigConstants.startupLoaded:
      if (action.error) {
        return state
      }
      let myDeviceRole = null

      if (action.payload.status.registered) {
        myDeviceRole = isMobile ? codePageDeviceRoleExistingPhone : codePageDeviceRoleExistingComputer
      } else {
        myDeviceRole = isMobile ? codePageDeviceRoleNewPhone : codePageDeviceRoleNewComputer
      }

      toMerge = {codePage: {myDeviceRole}}
      break
    case Constants.setOtherDeviceCodeState:
      toMerge = {codePage: {otherDeviceRole: action.payload}}
      break
    case Constants.setCodeMode:
      toMerge = {codePage: {mode: action.payload}}
      break
    case Constants.setTextCode:
      toMerge = {codePage: {textCode: action.payload}}
      break
    case Constants.setQRCode:
      toMerge = {codePage: {qrCode: action.payload}}
      break
    case Constants.qrScanned:
      toMerge = {codePage: {qrScanned: action.payload}}
      break
    case Constants.actionUpdateForgotPasswordEmailAddress:
      toMerge = {
        forgotPasswordEmailAddress: action.error ? null : action.payload,
        forgotPasswordSuccess: false,
        forgotPasswordError: action.error ? action.payload : null
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
      toMerge = {codePage: {cameraBrokenMode: action.payload}}
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
    case Constants.actionSetUserPass: {
      const {username, passphrase} = action.payload
      toMerge = {userPass: {username, passphrase}}
      break
    }
    case Constants.actionAskDeviceName: {
      const {onSubmit, existingDevices} = action.payload
      toMerge = {deviceName: {onSubmit, existingDevices}}
      break
    }
    case Constants.actionSetDeviceName:
      const deviceName = action.payload
      toMerge = {deviceName: {deviceName}}
      break
    default:
      return state
  }

  const s = Immutable.fromJS(state)
  return s.mergeDeep(toMerge).toJS()
}
