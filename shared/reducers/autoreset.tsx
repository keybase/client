import * as Container from '../util/container'
import type * as Types from '../constants/types/autoreset'
import * as AutoresetGen from '../actions/autoreset-gen'

const initialState: Types.State = {
  active: false,
  endTime: 0,
  error: '',
  hasWallet: false,
  skipPassword: false,
  username: '',
}

const clearErrors = (draftState: Container.Draft<Types.State>) => {
  draftState.error = ''
}

export default Container.makeReducer<AutoresetGen.Actions, Types.State>(initialState, {
  [AutoresetGen.resetStore]: () => {
    return initialState
  },
  // Logged-in
  [AutoresetGen.updateAutoresetState]: (draftState, action) => {
    const {active, endTime} = action.payload
    draftState.active = active
    draftState.endTime = endTime
  },
  [AutoresetGen.resetCancelled]: draftState => {
    draftState.active = false
  },
  // Logged-out
  [AutoresetGen.setUsername]: (draftState, action) => {
    draftState.username = action.payload.username
  },
  [AutoresetGen.startAccountReset]: (draftState, action) => {
    const {skipPassword} = action.payload
    draftState.skipPassword = skipPassword
    clearErrors(draftState)
  },
  [AutoresetGen.resetError]: (draftState, action) => {
    draftState.error = action.payload.error.desc
  },
  [AutoresetGen.showFinalResetScreen]: (draftState, action) => {
    draftState.hasWallet = action.payload.hasWallet
  },
  [AutoresetGen.displayProgress]: (draftState, action) => {
    if (!action.payload.needVerify) {
      draftState.endTime = action.payload.endTime
    }
  },
  // Actions that just reset the error
  [AutoresetGen.finishedReset]: clearErrors,
  [AutoresetGen.cancelReset]: clearErrors,
  [AutoresetGen.resetAccount]: clearErrors,
  [AutoresetGen.submittedReset]: clearErrors,
})
