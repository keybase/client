// @flow
import * as Types from '../constants/types/signup'
import * as Constants from '../constants/signup'
import * as SignupGen from '../actions/signup-gen'
import HiddenString from '../util/hidden-string'
import {trim} from 'lodash-es'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: SignupGen.Actions): Types.State {
  switch (action.type) {
    case SignupGen.resetStore: // fallthrough
    case SignupGen.restartSignup:
      return initialState
    case SignupGen.checkInviteCode:
      return state.set('inviteCode', action.payload.inviteCode)
    case SignupGen.checkInviteCodeDone:
      return action.payload.inviteCode === state.inviteCode
        ? state.set('inviteCodeError', (action.error && action.payload.error) || '')
        : state
    case SignupGen.checkUsernameEmail:
      return state.merge({
        email: action.payload.email,
        username: action.payload.username,
      })
    case SignupGen.checkUsernameEmailDone:
      return action.payload.email === state.email && action.payload.username === state.username
        ? state.merge({
            emailError: (action.error && action.payload.emailError) || '',
            usernameError: (action.error && action.payload.usernameError) || '',
          })
        : state
    case SignupGen.requestInvite:
      return state.merge({email: action.payload.email, username: action.payload.name})
    case SignupGen.requestInviteDone:
      return action.payload.email === state.email && action.payload.name === state.username
        ? state.merge({
            emailError: (action.error && action.payload.emailError) || '',
            nameError: (action.error && action.payload.nameError) || '',
          })
        : state
    case SignupGen.checkPassphrase:
      return state.set('passphrase', action.payload.pass1)
    case SignupGen.checkPassphraseDone:
      return action.payload.passphrase.stringValue() === state.passphrase.stringValue()
        ? state.merge({
            passphraseError: (action.error && action.payload.error) || new HiddenString(''),
          })
        : state
    case SignupGen.submitDevicename:
      return state.set('devicename', trim(action.payload.devicename))
    case SignupGen.submitDevicenameDone:
      return action.payload.devicename === state.devicename
        ? state.set('devicenameError', (action.error && action.payload.error) || '')
        : state
    case SignupGen.signupError:
      return state.set('signupError', action.payload.signupError)
    // Saga only actions
    case SignupGen.requestAutoInvite:
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
