// @flow
import * as Constants from '../constants/login'
import * as Types from '../constants/types/login'
import * as LoginGen from '../actions/login-gen'

export default function(state: Types.State = Constants.initialState, action: LoginGen.Actions): Types.State {
  switch (action.type) {
    case LoginGen.resetStore:
      return {...Constants.initialState}

    case LoginGen.setMyDeviceCodeState: {
      const {state: myDeviceRole} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          myDeviceRole,
        },
      }
    }
    case LoginGen.setOtherDeviceCodeState: {
      const {state: otherDeviceRole} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          otherDeviceRole,
        },
      }
    }
    case LoginGen.setCodePageMode: {
      const {mode} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          mode,
        },
      }
    }
    case LoginGen.setTextCode: {
      const {enterCodeErrorText, textCode} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          enterCodeErrorText,
          textCode,
        },
      }
    }
    case LoginGen.setQRCode: {
      const {qrCode} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCode,
        },
      }
    }
    case LoginGen.clearQRCode:
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCode: null,
        },
      }
    case LoginGen.qrScanned: {
      const {phrase} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          qrCodeScanned: true,
          qrScanned: phrase,
        },
      }
    }
    case LoginGen.setCameraBrokenMode: {
      const {broken} = action.payload
      return {
        ...state,
        codePage: {
          ...state.codePage,
          cameraBrokenMode: broken,
        },
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
      return {...state, codePage: {...state.codePage, qrCodeScanned: false}}
    case LoginGen.resetQRCodeScanned:
      return {...state, codePage: {...state.codePage, qrCodeScanned: false}}
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
