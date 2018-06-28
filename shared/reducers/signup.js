// @flow
import * as Types from '../constants/types/signup'
import * as Constants from '../constants/signup'
import * as SignupGen from '../actions/signup-gen'
import HiddenString from '../util/hidden-string'
import {trim} from 'lodash-es'
import {isValidEmail, isValidName, isValidUsername} from '../util/simple-validators'

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
    case SignupGen.checkUsernameEmail: {
      const {email, username} = action.payload
      const emailError = isValidEmail(email)
      const usernameError = isValidUsername(username)
      return state.merge({email, emailError, username, usernameError})
    }
    case SignupGen.validatedUsernameEmail:
      return action.payload.email === state.email && action.payload.username === state.username
        ? state.merge({
            emailError: (action.error && action.payload.emailError) || '',
            usernameError: (action.error && action.payload.usernameError) || '',
          })
        : state
    case SignupGen.requestInvite: {
      const {email, name} = action.payload
      const emailError = isValidEmail(email)
      const nameError = isValidName(name)
      return state.merge({
        email: action.payload.email,
        emailError,
        name: action.payload.name,
        nameError,
      })
    }
    case SignupGen.requestInviteDone:
      return action.payload.email === state.email && action.payload.name === state.username
        ? state.merge({
            emailError: (action.error && action.payload.emailError) || '',
            nameError: (action.error && action.payload.nameError) || '',
          })
        : state
    case SignupGen.checkPassphrase: {
      const {pass1, pass2} = action.payload
      const p1 = pass1.stringValue()
      const p2 = pass2.stringValue()
      let passphraseError = new HiddenString('')
      if (!p1 || !p2) {
        passphraseError = new HiddenString('Fields cannot be blank')
      } else if (p1 !== p2) {
        passphraseError = new HiddenString('Passphrases must match')
      } else if (p1.length < 6) {
        passphraseError = new HiddenString('Passphrase must be at least 6 characters long')
      }
      return state.merge({
        passphrase: action.payload.pass1,
        passphraseError,
      })
    }
    case SignupGen.submitDevicename: {
      const devicename = trim(action.payload.devicename)
      const devicenameError = devicename.length === 0 ? 'Device name must not be empty.' : ''
      return state.merge({devicename, devicenameError})
    }
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
