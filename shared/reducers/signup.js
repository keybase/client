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
    case SignupGen.checkInviteCode:
      return state.withMutations(s => {
        s.set('inviteCode', action.error ? '' : action.payload.inviteCode)
        s.set('inviteCodeError', action.error ? action.payload.errorText : '')
      })
    case SignupGen.checkUsernameEmailDone:
      return state.merge({
        email: action.payload.email,
        emailError: action.error ? action.payload.emailError : '',
        username: action.payload.username,
        usernameError: action.error ? action.payload.usernameError : '',
      })
    case SignupGen.requestInvite:
      return state.merge({
        email: action.payload.email,
        emailError: action.error ? action.payload.emailError : '',
        nameError: action.error ? action.payload.nameError : '',
        username: action.payload.name,
      })
    case SignupGen.checkPassphrase:
      return state.merge({
        passphrase: action.error ? null : action.payload.passphrase,
        passphraseError: action.error ? action.payload.passphraseError : null,
      })
    case SignupGen.setDeviceNameError:
      return state.set('deviceNameError', action.payload.deviceNameError)
    case SignupGen.clearDeviceNameError:
      return state.set('deviceNameError', '')
    case SignupGen.submitDeviceName:
      return state.merge({
        deviceName: action.error ? '' : action.payload.deviceName,
        deviceNameError: action.error ? action.payload.deviceNameError : '',
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
    case SignupGen.startRequestInvite:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
