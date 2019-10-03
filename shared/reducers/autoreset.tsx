import * as Container from '../util/container'
import * as Types from '../constants/types/autoreset'
import * as AutoresetGen from '../actions/autoreset-gen'
const initialState: Types.State = {
  active: false,
  endTime: 0,
  error: '',
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
        return
      case AutoresetGen.resetError:
        draftState.error = action.payload.error.desc
        return
      case AutoresetGen.submittedReset:
        draftState.error = ''
        // TODO: get endTime in RPC response from kbweb
        draftState.endTime = Date.now() + 7 * 24 * 60 * 60 * 1000
        return

      // saga only actions
      case AutoresetGen.resetAccount:
      case AutoresetGen.cancelReset:
        return
    }
  })
