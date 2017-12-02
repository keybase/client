// @flow
import * as Constants from '../constants/login'
import * as Types from '../constants/types/login'
import * as LoginGen from '../actions/login-gen'

export default function(state: Types.State = Constants.initialState, action: LoginGen.Actions): Types.State {
  switch (action.type) {
    case LoginGen.resetStore:
      return {...Constants.initialState}

    case LoginGen.setMyDeviceCodeState: {
      const {codePageMyDeviceRole} = action.payload
      return {
        ...state,
        codePageMyDeviceRole,
      }
    }
    case LoginGen.setOtherDeviceCodeState: {
      const {codePageOtherDeviceRole} = action.payload
      return {
        ...state,
        codePageOtherDeviceRole,
      }
    }
    case LoginGen.setCodePageMode: {
      const {codePageMode} = action.payload
      return {
        ...state,
        codePageMode,
      }
    }
    case LoginGen.setTextCode: {
      const {codePageEnterCodeErrorText, codePageTextCode} = action.payload
      return {
        ...state,
        codePageEnterCodeErrorText,
        codePageTextCode,
      }
    }
    case LoginGen.setQRCode: {
      const {codePageQrCode} = action.payload
      return {
        ...state,
        codePageQrCode,
      }
    }
    case LoginGen.clearQRCode:
      return {
        ...state,
        codePageQrCode: null,
      }
    case LoginGen.qrScanned: {
      const {phrase} = action.payload
      return {
        ...state,
        codePageQrCodeScanned: true,
        codePageQrScanned: phrase,
      }
    }
    case LoginGen.setCameraBrokenMode: {
      const {codePageCameraBrokenMode} = action.payload
      return {
        ...state,
        codePageCameraBrokenMode,
      }
    }
    case LoginGen.configuredAccounts:
      if (action.payload.error) {
        return {...state, configuredAccounts: []}
      } else {
        const {accounts} = action.payload
        return {...state, configuredAccounts: accounts}
      }
    case LoginGen.waitingForResponse: {
      const {waiting} = action.payload
      return {...state, waitingForResponse: waiting}
    }
    case LoginGen.provisioningError:
      return {...state, codePageQrCodeScanned: false}
    case LoginGen.resetQRCodeScanned:
      return {...state, codePageQrCodeScanned: false}
    case LoginGen.setRevokedSelf: {
      const {revoked} = action.payload
      return {...state, justRevokedSelf: revoked}
    }
    case LoginGen.setDeletedSelf: {
      const {deletedUsername} = action.payload
      return {...state, justDeletedSelf: deletedUsername}
    }
    // Saga only actions
    case LoginGen.addNewDevice:
    case LoginGen.chooseGPGMethod:
    case LoginGen.logout:
    case LoginGen.logoutDone:
    case LoginGen.navBasedOnLoginAndInitialState:
    case LoginGen.onBack:
    case LoginGen.onFinish:
    case LoginGen.onWont:
    case LoginGen.openAccountResetPage:
    case LoginGen.provisionTextCodeEntered:
    case LoginGen.relogin:
    case LoginGen.selectDeviceId:
    case LoginGen.startLogin:
    case LoginGen.submitDeviceName:
    case LoginGen.submitPassphrase:
    case LoginGen.submitUsernameOrEmail:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
