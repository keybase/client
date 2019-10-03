import * as Container from '../util/container'
import * as Types from '../constants/types/autoreset'
import * as AutoresetGen from '../actions/autoreset-gen'
const initialState: Types.State = {
  active: false,
  endTime: 0,
  error: '',
  hasWallet: false,
  skipPassword: false,
  username: '',
}

export default (state: Types.State = initialState, action: AutoresetGen.Actions): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case AutoresetGen.resetStore:
        return initialState

      // Logged-in
      case AutoresetGen.updateAutoresetState:
        draftState.active = action.payload.active
        draftState.endTime = action.payload.endTime
        return
      case AutoresetGen.resetCancelled:
        draftState.active = false
        return

      // Logged-out
      case AutoresetGen.setUsername:
        draftState.username = action.payload.username
        return
      case AutoresetGen.startAccountReset:
        draftState.skipPassword = action.payload.skipPassword
        draftState.error = ''
        return
      case AutoresetGen.resetError:
        draftState.error = action.payload.error.desc
        return
      case AutoresetGen.showFinalResetScreen:
        draftState.hasWallet = action.payload.hasWallet
        return
      case AutoresetGen.displayProgress:
        draftState.endTime = action.payload.endTime
        return

      // TODO: clear error on submit final prompt
      // Actions that just reset the error
      case AutoresetGen.cancelReset:
      case AutoresetGen.resetAccount:
      case AutoresetGen.submittedReset:
        draftState.error = ''
        return
    }
  })
