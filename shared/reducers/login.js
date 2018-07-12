// @flow
import * as I from 'immutable'
import * as Constants from '../constants/login'
import * as Types from '../constants/types/login'
import * as LoginGen from '../actions/login-gen'
import * as SignupGen from '../actions/signup-gen'
import HiddenString from '../util/hidden-string'

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
      return state.merge({error: initialState.error, justDeletedSelf: '', justRevokedSelf: ''})
    case LoginGen.submitUsernameOrEmail:
      return state.merge({
        error: initialState.error,
        provisionUsernameOrEmail: action.payload.usernameOrEmail,
      })
    case LoginGen.showNewDeviceNamePage:
      return state.merge({
        error: action.payload.error || initialState.error,
        provisionExistingDevices: I.List(action.payload.existingDevices),
      })
    case LoginGen.showDeviceListPage:
      return state.merge({
        error: initialState.error,
        provisionDevices: I.List(action.payload.devices),
        provisionDevicesCanSelectNoDevice: action.payload.canSelectNoDevice,
      })
    case LoginGen.submitProvisionDeviceSelect:
      return state.merge({
        error: initialState.error,
        provisionSelectedDevice: state.provisionDevices.find(d => d.name === action.payload.name),
      })
    case LoginGen.submitProvisionTextCode:
      return state.merge({
        codePageTextCode: action.payload.phrase,
        error: initialState.error,
      })
    case LoginGen.submitProvisionDeviceName:
      if (state.provisionExistingDevices.indexOf(state.provisionDeviceName) !== -1) {
        return state.merge({
          error: new HiddenString(
            `The device name: '${
              state.provisionDeviceName
            }' is already taken. You can't reuse device names, even revoked ones, for security reasons. Otherwise, someone who stole one of your devices could cause a lot of confusion.`
          ),
          provisionDeviceName: action.payload.name,
        })
      }
      return state.merge({
        error: initialState.error,
        provisionDeviceName: action.payload.name,
      })
    case LoginGen.showCodePage:
      return state.merge({
        codePageTextCode: action.payload.code,
        error: action.payload.error || initialState.error,
      })
    case LoginGen.configuredAccounts:
      return state.set(
        'configuredAccounts',
        I.List(((!action.payload.error && action.payload.accounts) || []).map(a => Constants.makeAccount(a)))
      )
    case LoginGen.loginError:
      return state.set('error', action.payload.error || initialState.error)
    case LoginGen.setRevokedSelf:
      return state.set('justRevokedSelf', action.payload.revoked)
    case LoginGen.setDeletedSelf:
      return state.set('justDeletedSelf', action.payload.deletedUsername)
    // Saga only actions
    case LoginGen.addNewDevice:
    case LoginGen.submitProvisionGPGMethod:
    case LoginGen.logout:
    case LoginGen.showGPGPage:
    case LoginGen.loggedout:
    case LoginGen.navBasedOnLoginAndInitialState:
    case LoginGen.onBack:
    case LoginGen.onFinish:
    case LoginGen.showPassphrasePage:
    case LoginGen.launchAccountResetWebPage:
    case LoginGen.submitProvisionPasswordInsteadOfDevice:
    case LoginGen.launchForgotPasswordWebPage:
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
