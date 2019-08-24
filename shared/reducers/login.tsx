import * as Constants from '../constants/login'
import * as Types from '../constants/types/login'
import * as LoginGen from '../actions/login-gen'
import * as SignupGen from '../actions/signup-gen'
import * as ProvisionGen from '../actions/provision-gen'

const initialState = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action: LoginGen.Actions | SignupGen.RequestAutoInvitePayload | ProvisionGen.StartProvisionPayload
): Types.State {
  switch (action.type) {
    case LoginGen.resetStore:
      return initialState
    case SignupGen.requestAutoInvite: // fallthrough
    case LoginGen.login: // fallthrough
    case ProvisionGen.startProvision:
      return state.merge({error: initialState.error})
    case LoginGen.loginError:
      return state.merge({error: action.payload.error || initialState.error})
    case LoginGen.loadedIsOnline:
      return state.merge({isOnline: action.payload.result})
    // Saga only actions
    case LoginGen.launchAccountResetWebPage:
    case LoginGen.launchForgotPasswordWebPage:
      return state
    default:
      return state
  }
}
