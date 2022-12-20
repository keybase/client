import type * as Types from '../constants/types/login'
import * as LoginGen from '../actions/login-gen'
import * as SignupGen from '../actions/signup-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as Container from '../util/container'

const initialState = {
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  registerUserPassLoading: false,
}

type Actions = LoginGen.Actions | SignupGen.RequestAutoInvitePayload | ProvisionGen.StartProvisionPayload

const clearErrors = (draftState: Container.Draft<Types.State>) => {
  draftState.error = undefined
}

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [LoginGen.resetStore]: () => initialState,
  [LoginGen.loginError]: (draftState, action) => {
    draftState.error = action.payload.error
  },
  [LoginGen.loadedIsOnline]: (draftState, action) => {
    draftState.isOnline = action.payload.isOnline
  },
  [SignupGen.requestAutoInvite]: draftState => clearErrors(draftState),
  [LoginGen.login]: draftState => clearErrors(draftState),
  [ProvisionGen.startProvision]: draftState => clearErrors(draftState),
})
