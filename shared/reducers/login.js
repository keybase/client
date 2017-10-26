// @flow
import * as CommonConstants from '../constants/common'
import * as ConfigConstants from '../constants/config'
import * as Constants from '../constants/login'

const initialState: Constants.State = {
  codePage: {
    cameraBrokenMode: false,
    codeCountDown: 0,
    enterCodeErrorText: '',
    mode: null,
    myDeviceRole: null,
    otherDeviceRole: null,
    qrCode: null,
    qrCodeScanned: false,
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

export default function(state: Constants.State = initialState, action: any): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case ConfigConstants.statusLoaded:
      if (action.error || action.payload == null) {
        return state
      }
      break
    case Constants.setMyDeviceCodeState:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          myDeviceRole: action.payload,
        },
      }
    case Constants.setOtherDeviceCodeState:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          otherDeviceRole: action.payload,
        },
      }
    case Constants.setCodeMode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          mode: action.payload,
        },
      }
    case Constants.setTextCode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          enterCodeErrorText: action.payload.enterCodeErrorText,
          textCode: action.payload.textCode,
        },
      }
    case Constants.setQRCode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCode: action.payload.qrCode,
        },
      }
    case Constants.clearQRCode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCode: null,
        },
      }
    case Constants.qrScanned:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCodeScanned: true,
          qrScanned: action.payload,
        },
      }
    case Constants.actionUpdateForgotPasswordEmailAddress:
      return {
        ...state,
        forgotPasswordEmailAddress: action.error ? '' : action.payload,
        forgotPasswordError: action.error ? action.payload : null,
        forgotPasswordSuccess: false,
      }
    case Constants.actionSetForgotPasswordSubmitting:
      return {
        ...state,
        forgotPasswordError: null,
        forgotPasswordSubmitting: true,
        forgotPasswordSuccess: false,
      }
    case Constants.actionForgotPasswordDone:
      return {
        ...state,
        forgotPasswordError: action.error,
        forgotPasswordSubmitting: false,
        forgotPasswordSuccess: !action.error,
      }
    case Constants.cameraBrokenMode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          cameraBrokenMode: action.payload,
        },
      }
    case Constants.configuredAccounts:
      if (action.payload.error) {
        return {...state, configuredAccounts: []}
      } else {
        return {...state, configuredAccounts: action.payload.accounts}
      }
    case Constants.waitingForResponse:
      return {...state, waitingForResponse: action.payload}
    case Constants.loginDone:
      if (action.error) {
        return {...state, loginError: action.payload && action.payload.message}
      } else {
        return state
      }
    case Constants.provisioningError:
      return {...state, codePage: {...state.codePage, qrCodeScanned: false}}
    case Constants.resetQRCodeScanned:
      return {...state, codePage: {...state.codePage, qrCodeScanned: false}}
    case Constants.setRevokedSelf:
      return {...state, justRevokedSelf: action.payload}
    case Constants.setDeletedSelf:
      return {...state, justDeletedSelf: action.payload}
    case Constants.setLoginFromRevokedDevice:
      return {...state, justLoginFromRevokedDevice: action.payload}
    default:
      return state
  }

  return state
}
