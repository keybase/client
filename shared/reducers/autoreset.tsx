import * as Container from '../util/container'
import * as Types from '../constants/types/autoreset'
import * as AutoresetGen from '../actions/autoreset-gen'

const initialState: Types.State = {
  endTime: 0,
  error: '',
  skipPassword: false,
  username: '',
}

export default (state: Types.State = initialState, action: AutoresetGen.Actions): Types.State =>
  Container.produce(state, (draftState: Types.State) => {
    switch (action.type) {
      case AutoresetGen.resetStore:
        return initialState
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
      case AutoresetGen.resetAccount:
        return
    }
  })
