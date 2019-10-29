import * as I from 'immutable'
import * as Constants from '../constants/recover-password'
import * as Types from '../constants/types/recover-password'
import * as RecoverPasswordGen from '../actions/recover-password-gen'
import HiddenString from '../util/hidden-string'

const emptyHiddenString = new HiddenString('')
const initialState = Constants.makeState()

type Actions = RecoverPasswordGen.Actions

export default function(state: Types.State = initialState, action: Actions): Types.State {
  switch (action.type) {
    case RecoverPasswordGen.startRecoverPassword:
      return state.merge({
        paperKeyError: new HiddenString(''),
        username: action.payload.username,
      })
    case RecoverPasswordGen.displayDeviceSelect:
      return state.merge({
        devices: I.List(action.payload.devices),
      })
    case RecoverPasswordGen.showExplainDevice:
      return state.merge({
        explainedDevice: {
          name: action.payload.name,
          type: action.payload.type,
        },
      })
    case RecoverPasswordGen.submitPaperKey:
      return state.merge({paperKeyError: emptyHiddenString})
    case RecoverPasswordGen.setPaperKeyError:
      return state.merge({
        paperKeyError: action.payload.error,
      })
    case RecoverPasswordGen.submitPassword:
      return state.merge({passwordError: emptyHiddenString})
    case RecoverPasswordGen.setPasswordError:
      return state.merge({
        passwordError: action.payload.error,
      })
    case RecoverPasswordGen.displayError:
      return state.merge({
        error: action.payload.error,
      })
    case RecoverPasswordGen.completeResetPassword:
      return state.merge({
        resetEmailSent: true,
      })
    case RecoverPasswordGen.resetResetPasswordState:
      return state.merge({
        resetEmailSent: false,
      })
    default:
      return state
  }
}
