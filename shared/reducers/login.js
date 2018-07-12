// @flow
import * as I from 'immutable'
import * as Constants from '../constants/login'
import * as Types from '../constants/types/login'
import * as LoginGen from '../actions/login-gen'
import * as SignupGen from '../actions/signup-gen'

const initialState = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action: LoginGen.Actions | SignupGen.RequestAutoInvitePayload
): Types.State {
  switch (action.type) {
    case LoginGen.resetStore:
      return initialState
    case SignupGen.requestAutoInvite: // fallthrough
    case LoginGen.login: // fallthrough
    case LoginGen.startLogin:
      return state.merge({error: '', justDeletedSelf: '', justRevokedSelf: ''})
    case LoginGen.submitUsernameOrEmail:
      return state.merge({
        error: '',
        provisionUsernameOrEmail: action.payload.usernameOrEmail,
      })
    case LoginGen.showNewDeviceName:
      return state.merge({
        error: action.payload.error,
        provisionExistingDevices: I.List(action.payload.existingDevices),
      })
    case LoginGen.setTextCode: {
      return state.merge({
        // TODO error
        // codePageTextCodeError: action.payload.codePageEnterCodeErrorText,
        codePageTextCode: action.payload.textCode,
      })
    }
    case LoginGen.qrScanned:
      return state // TODO
    case LoginGen.showDeviceList:
      return state.merge({
        error: '',
        provisionDevices: I.List(action.payload.devices),
        provisionDevicesCanSelectNoDevice: action.payload.canSelectNoDevice,
      })
    case LoginGen.provisionDeviceSelect:
      return state.set(
        'provisionSelectedDevice',
        state.provisionDevices.find(d => d.name === action.payload.name)
      )
    case LoginGen.configuredAccounts:
      return state.set(
        'configuredAccounts',
        I.List(((!action.payload.error && action.payload.accounts) || []).map(a => Constants.makeAccount(a)))
      )
    case LoginGen.loginError:
      return state.set('error', action.payload.error)
    case LoginGen.setRevokedSelf:
      return state.set('justRevokedSelf', action.payload.revoked)
    case LoginGen.setDeletedSelf:
      return state.set('justDeletedSelf', action.payload.deletedUsername)
    // Saga only actions
    case LoginGen.provisioningError:
    case LoginGen.addNewDevice:
    case LoginGen.chooseGPGMethod:
    case LoginGen.logout:
    case LoginGen.logoutDone:
    case LoginGen.navBasedOnLoginAndInitialState:
    case LoginGen.onBack:
    case LoginGen.onFinish:
    case LoginGen.launchAccountResetWebPage:
    case LoginGen.provisionPasswordInsteadOfDevice:
    case LoginGen.launchForgotPasswordWebPage:
    case LoginGen.provisionTextCodeEntered:
    case LoginGen.submitDeviceName:
    case LoginGen.submitPassphrase:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
