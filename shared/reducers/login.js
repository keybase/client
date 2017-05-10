// @flow
import * as CommonConstants from '../constants/common'
import * as ConfigConstants from '../constants/config'
import * as Constants from '../constants/login'
import {fromJS} from 'immutable'

const initialState: Constants.State = {
  codePage: {
    cameraBrokenMode: false,
    codeCountDown: 0,
    enterCodeErrorText: '',
    mode: null,
    myDeviceRole: null,
    otherDeviceRole: null,
    qrCode: null,
    qrScanned: null,
    textCode: null,
  },
  configuredAccounts: null,
  deviceName: {
    deviceName: '',
    existingDevices: [],
    onSubmit: () => {},
  },
  forgotPasswordEmailAddress: '',
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  justDeletedSelf: null,
  justLoginFromRevokedDevice: null,
  justRevokedSelf: null,
  loginError: null,
  registerUserPassError: null,
  registerUserPassLoading: false,
  waitingForResponse: false,
}

export default function(
  state: Constants.State = initialState,
  action: any
): Constants.State {
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
      toMerge = {
        codePage: {
          enterCodeErrorText: action.payload.enterCodeErrorText,
          textCode: action.payload.textCode,
        },
      }
      break
    case Constants.setQRCode:
      toMerge = {codePage: {qrCode: action.payload.qrCode}}
      break
    case Constants.qrScanned:
      toMerge = {codePage: {qrScanned: action.payload}}
      break
    case Constants.actionUpdateForgotPasswordEmailAddress:
      toMerge = {
        forgotPasswordEmailAddress: action.error ? null : action.payload,
        forgotPasswordError: action.error ? action.payload : null,
        forgotPasswordSuccess: false,
      }
      break
    case Constants.actionSetForgotPasswordSubmitting:
      toMerge = {
        forgotPasswordError: null,
        forgotPasswordSubmitting: true,
        forgotPasswordSuccess: false,
      }
      break
    case Constants.actionForgotPasswordDone:
      toMerge = {
        forgotPasswordError: action.error,
        forgotPasswordSubmitting: false,
        forgotPasswordSuccess: !action.error,
      }
      break
    case Constants.cameraBrokenMode:
      toMerge = {codePage: {cameraBrokenMode: action.payload}}
      break
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
    case Constants.setDeletedSelf:
      toMerge = {justDeletedSelf: action.payload}
      break
    case Constants.setLoginFromRevokedDevice:
      toMerge = {justLoginFromRevokedDevice: action.payload}
      break
    default:
      return state
  }

  const s = fromJS(state)
  return s.mergeDeep(toMerge).toJS()
}
