// @flow
import * as Constants from '../constants/engine'
import * as EngineGen from '../actions/engine-gen'

const initialState: Constants.State = Constants.makeState()

export default function(state: Constants.State = initialState, action: EngineGen.Actions) {
  switch (action.type) {
    case EngineGen.resetStore:
      return initialState
    case EngineGen.waitingForRpc:
      const payload = action.payload
      return state.update('rpcWaitingStates', waitingStates =>
        waitingStates.set(payload.rpcName, payload.waiting)
      )
  }

  return state
}
