// @flow
import * as Types from '../constants/types/signup'
import * as Constants from '../constants/signup'
import * as SignupGen from '../actions/signup-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: SignupGen.Actions): Types.State {
  switch (action.type) {
    case SignupGen.resetStore: // fallthrough
    case SignupGen.resetSignup:
      return initialState
    case SignupGen.checkInviteCodeDone:
      return state.merge({
        inviteCode: action.payload.inviteCode,
        inviteCodeError: action.error ? action.payload.errorText : '',
      })
    case SignupGen.checkUsernameEmailDone:
      return state.merge({
        email: action.payload.email,
        emailError: action.error ? action.payload.emailError : '',
        username: action.payload.username,
        usernameError: action.error ? action.payload.usernameError : '',
      })
    case SignupGen.requestInviteDone:
      return state.merge({
        email: action.payload.email,
        emailError: action.error ? action.payload.emailError : '',
        nameError: action.error ? action.payload.nameError : '',
        username: action.payload.name,
      })
    case SignupGen.checkPassphraseDone:
      return state.merge({
        passphrase: action.payload.passphrase,
        passphraseError: action.error ? action.payload.error : null,
      })
    case SignupGen.submitDevicenameDone:
      return state.merge({
        devicename: action.payload.devicename,
        devicenameError: action.error ? action.payload.error : '',
      })
    case SignupGen.signupError:
      return state.set('signupError', action.payload.signupError)
    case SignupGen.restartSignup:
      return state.merge({
        inviteCodeError: '',
        passphraseError: null,
      })
    // Saga only
    case SignupGen.checkUsernameEmail:
    case SignupGen.requestInvite:
    case SignupGen.requestAutoInvite:
    case SignupGen.checkInviteCode:
    case SignupGen.submitDevicename:
    case SignupGen.checkPassphrase:
    case SignupGen.signup:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
