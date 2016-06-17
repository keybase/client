/* @flow */

import * as Constants from '../constants/login'
import * as ConfigConstants from '../constants/config'
import * as CommonConstants from '../constants/common'
import {fromJS} from 'immutable'

import type {DeviceRole, Mode} from '../constants/login'

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
  configuredAccounts: ?Array<{hasStoredSecret: bool, username: string}>,
  waitingForResponse: boolean,
  loginError: ?string,
  justRevokedSelf: ?string
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
    qrCode: null,
  },
  registerUserPassError: null,
  registerUserPassLoading: false,
  forgotPasswordEmailAddress: '',
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  forgotPasswordError: null,
  deviceName: {
    onSubmit: () => {},
    existingDevices: [],
    deviceName: '',
  },
  configuredAccounts: null,
  waitingForResponse: false,
  loginError: null,
  justRevokedSelf: null,
}

export default function (state: LoginState = initialState, action: any): LoginState {
  let toMerge = null

  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case ConfigConstants.statusLoaded:
      if (action.error || action.payload == null) {
        return state
      }
      break
    case Constants.setMyDeviceCodeState:
      toMerge = {codePage: {myDeviceRole: action.payload}}
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
        forgotPasswordError: action.error ? action.payload : null,
      }
      break
    case Constants.actionSetForgotPasswordSubmitting:
      toMerge = {
        forgotPasswordSubmitting: true,
        forgotPasswordSuccess: false,
        forgotPasswordError: null,
      }
      break
    case Constants.actionForgotPasswordDone:
      toMerge = {
        forgotPasswordSubmitting: false,
        forgotPasswordSuccess: !action.error,
        forgotPasswordError: action.error,
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
          qrCode: null,
        },
      }
      break
    }
    case Constants.configuredAccounts:
      if (action.payload.error) {
        toMerge = {configuredAccounts: []}
      } else {
        toMerge = {configuredAccounts: action.payload.accounts}
      }
      break
    case Constants.waitingForResponse:
      toMerge = {waitingForResponse: action.payload}
      break
    case Constants.loginDone:
      if (action.error) {
        toMerge = {loginError: action.payload && action.payload.message}
      } else {
        return state
      }
      break
    case Constants.setRevokedSelf:
      toMerge = {justRevokedSelf: action.payload}
      break
    default:
      return state
  }

  const s = fromJS(state)
  return s.mergeDeep(toMerge).toJS()
}
