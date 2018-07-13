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
    case LoginGen.logout:
    case LoginGen.loggedout:
    case LoginGen.navBasedOnLoginAndInitialState:
    case LoginGen.onBack:
    case LoginGen.onFinish:
    case LoginGen.launchAccountResetWebPage:
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
