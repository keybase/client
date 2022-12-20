import * as Constants from '../constants/recover-password'
import type * as Types from '../constants/types/recover-password'
import * as RecoverPasswordGen from '../actions/recover-password-gen'
import * as Container from '../util/container'

const emptyHiddenString = new Container.HiddenString('')
const initialState = Constants.makeState()

type Actions = RecoverPasswordGen.Actions

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [RecoverPasswordGen.resetStore]: () => initialState,
  [RecoverPasswordGen.startRecoverPassword]: (draftState, action) => {
    draftState.paperKeyError = emptyHiddenString
    draftState.username = action.payload.username
  },
  [RecoverPasswordGen.displayDeviceSelect]: (draftState, action) => {
    draftState.devices = action.payload.devices
  },
  [RecoverPasswordGen.showExplainDevice]: (draftState, action) => {
    draftState.explainedDevice = {
      name: action.payload.name,
      type: action.payload.type,
    }
  },
  [RecoverPasswordGen.submitPaperKey]: draftState => {
    draftState.paperKeyError = emptyHiddenString
  },
  [RecoverPasswordGen.setPaperKeyError]: (draftState, action) => {
    draftState.paperKeyError = action.payload.error
  },
  [RecoverPasswordGen.submitPassword]: draftState => {
    draftState.passwordError = emptyHiddenString
  },
  [RecoverPasswordGen.setPasswordError]: (draftState, action) => {
    draftState.passwordError = action.payload.error
  },
  [RecoverPasswordGen.displayError]: (draftState, action) => {
    draftState.error = action.payload.error
  },
  [RecoverPasswordGen.completeResetPassword]: draftState => {
    draftState.resetEmailSent = true
  },
  [RecoverPasswordGen.resetResetPasswordState]: draftState => {
    draftState.resetEmailSent = false
  },
})
