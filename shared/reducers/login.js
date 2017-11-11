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
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  justDeletedSelf: null,
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
      const {state: myDeviceRole} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          myDeviceRole,
        },
      }
    case LoginGen.setOtherDeviceCodeState:
      const {state: otherDeviceRole} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          otherDeviceRole,
        },
      }
    case LoginGen.setCodePageMode:
      const {mode} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          mode,
        },
      }
    case LoginGen.setTextCode:
      const {enterCodeErrorText, textCode} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          enterCodeErrorText,
          textCode,
        },
      }
    case LoginGen.setQRCode:
      const {qrCode} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCode,
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
      const {phrase} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCodeScanned: true,
          qrScanned: phrase,
        },
      }
    case LoginGen.setCameraBrokenMode:
      const {broken} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          cameraBrokenMode: broken,
        },
      }
    case LoginGen.configuredAccounts:
      if (action.payload.error) {
        return {...state, configuredAccounts: []}
      } else {
        const {accounts} = action.payload
        return {...state, configuredAccounts: accounts}
      }
    case LoginGen.waitingForResponse:
      const {waiting} = action.payload
      return {...state, waitingForResponse: waiting}
    case LoginGen.provisioningError:
      return {...state, codePage: {...state.codePage, qrCodeScanned: false}}
    case LoginGen.resetQRCodeScanned:
      return {...state, codePage: {...state.codePage, qrCodeScanned: false}}
    case LoginGen.setRevokedSelf:
      const {revoked} = action.payload
      return {...state, justRevokedSelf: revoked}
    case LoginGen.setDeletedSelf:
      const {deletedUsername} = action.payload
      return {...state, justDeletedSelf: deletedUsername}
    default:
      return state
  }
}
