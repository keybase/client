// @flow
import * as Constants from '../constants/login'
import * as LoginGen from '../actions/login-gen'

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

export default function(state: Constants.State = initialState, action: LoginGen.Actions): Constants.State {
  switch (action.type) {
    case LoginGen.resetStore:
      return {...initialState}

    case LoginGen.setMyDeviceCodeState:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          myDeviceRole: action.payload,
        },
      }
    case LoginGen.setOtherDeviceCodeState:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          otherDeviceRole: action.payload,
        },
      }
    case LoginGen.setCodeMode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          mode: action.payload,
        },
      }
    case LoginGen.setTextCode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          enterCodeErrorText: action.payload.enterCodeErrorText,
          textCode: action.payload.textCode,
        },
      }
    case LoginGen.setQRCode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCode: action.payload.qrCode,
        },
      }
    case LoginGen.clearQRCode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCode: null,
        },
      }
    case LoginGen.qrScanned:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCodeScanned: true,
          qrScanned: action.payload,
        },
      }
    case LoginGen.actionUpdateForgotPasswordEmailAddress:
      return {
        ...state,
        forgotPasswordEmailAddress: action.error ? '' : action.payload,
        forgotPasswordError: action.error ? action.payload : null,
        forgotPasswordSuccess: false,
      }
    case LoginGen.actionSetForgotPasswordSubmitting:
      return {
        ...state,
        forgotPasswordError: null,
        forgotPasswordSubmitting: true,
        forgotPasswordSuccess: false,
      }
    case LoginGen.actionForgotPasswordDone:
      return {
        ...state,
        forgotPasswordError: action.error,
        forgotPasswordSubmitting: false,
        forgotPasswordSuccess: !action.error,
      }
    case LoginGen.cameraBrokenMode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          cameraBrokenMode: action.payload,
        },
      }
    case LoginGen.configuredAccounts:
      if (action.payload.error) {
        return {...state, configuredAccounts: []}
      } else {
        return {...state, configuredAccounts: action.payload.accounts}
      }
    case LoginGen.waitingForResponse:
      return {...state, waitingForResponse: action.payload}
    case LoginGen.relogin:
      if (action.error) {
        return {...state, loginError: action.payload && action.payload.message}
      } else {
        return state
      }
    case LoginGen.provisioningError:
      return {...state, codePage: {...state.codePage, qrCodeScanned: false}}
    case LoginGen.resetQRCodeScanned:
      return {...state, codePage: {...state.codePage, qrCodeScanned: false}}
    case LoginGen.setRevokedSelf:
      return {...state, justRevokedSelf: action.payload}
    case LoginGen.setDeletedSelf:
      return {...state, justDeletedSelf: action.payload}
    case LoginGen.setLoginFromRevokedDevice:
      return {...state, justLoginFromRevokedDevice: action.payload}
    default:
      return state
  }
}
