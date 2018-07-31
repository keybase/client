// @flow
import * as Constants from '../constants/login'
import * as Types from '../constants/types/login'
import * as LoginGen from '../actions/login-gen'
import * as DevicesGen from '../actions/devices-gen'
import * as SignupGen from '../actions/signup-gen'
import * as ProvisionGen from '../actions/provision-gen'

const initialState = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action:
    | LoginGen.Actions
    | SignupGen.RequestAutoInvitePayload
    | ProvisionGen.StartProvisionPayload
    | DevicesGen.RevokedPayload
): Types.State {
  switch (action.type) {
    case LoginGen.resetStore:
      return initialState
    case SignupGen.requestAutoInvite: // fallthrough
    case LoginGen.login: // fallthrough
    case ProvisionGen.startProvision:
      return state.merge({error: initialState.error, justDeletedSelf: '', justRevokedSelf: ''})
    case DevicesGen.revoked:
      return action.payload.wasCurrentDevice ? state.set('justRevokedSelf', action.payload.deviceName) : state
    case LoginGen.loginError:
      return state.set('error', action.payload.error || initialState.error)
    case LoginGen.setDeletedSelf:
      return state.set('justDeletedSelf', action.payload.deletedUsername)
    // Saga only actions
    case LoginGen.logout:
    case LoginGen.loggedin:
    case LoginGen.loggedout:
    case LoginGen.navBasedOnLoginAndInitialState:
    case LoginGen.onFinish:
    case LoginGen.launchAccountResetWebPage:
    case LoginGen.launchForgotPasswordWebPage:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
