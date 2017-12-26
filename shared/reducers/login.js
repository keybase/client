// @flow
import * as I from 'immutable'
import * as Constants from '../constants/login'
import * as Types from '../constants/types/login'
import * as LoginGen from '../actions/login-gen'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: LoginGen.Actions): Types.State {
  switch (action.type) {
    case LoginGen.resetStore:
      return initialState
    case LoginGen.setMyDeviceCodeState:
      return state.set('codePageMyDeviceRole', action.payload.codePageMyDeviceRole)
    case LoginGen.setOtherDeviceCodeState:
      return state.set('codePageOtherDeviceRole', action.payload.codePageOtherDeviceRole)
    case LoginGen.setCodePageMode:
      return state.set('codePageMode', action.payload.codePageMode)
    case LoginGen.setTextCode: {
      const {codePageEnterCodeErrorText, codePageTextCode} = action.payload
      return state
        .set('codePageEnterCodeErrorText', codePageEnterCodeErrorText)
        .set('codePageTextCode', codePageTextCode)
    }
    case LoginGen.setQRCode:
      return state.set('codePageQrCode', action.payload.codePageQrCode)
    case LoginGen.clearQRCode:
      return state.set('codePageQrCode', null)
    case LoginGen.qrScanned:
      return state.set('codePageQrScanned', action.payload.phrase).set('codePageQrCodeScanned', true)
    case LoginGen.setCameraBrokenMode:
      return state.set('codePageCameraBrokenMode', action.payload.codePageCameraBrokenMode)
    case LoginGen.configuredAccounts:
      return action.payload.error
        ? state.set('configuredAccounts', I.List())
        : state.set(
            'configuredAccounts',
            I.List((action.payload.accounts || []).map(a => Constants.makeAccount(a)))
          )
    case LoginGen.waitingForResponse:
      return state.set('waitingForResponse', action.payload.waiting)
    case LoginGen.provisioningError:
    case LoginGen.resetQRCodeScanned: // fallthrough
      return state.set('codePageQrCodeScanned', false)
    case LoginGen.setRevokedSelf:
      return state.set('justRevokedSelf', action.payload.revoked)
    case LoginGen.setDeletedSelf:
      return state.set('justDeletedSelf', action.payload.deletedUsername)
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
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
