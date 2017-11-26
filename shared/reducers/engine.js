// @flow
import * as Constants from '../constants/engine'
import * as Types from '../constants/types/engine'
import * as EngineGen from '../actions/engine-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: EngineGen.Actions) {
  switch (action.type) {
    case EngineGen.resetStore:
      return initialState
    case EngineGen.waitingForRpc:
      const payload = action.payload
      return state.update('rpcWaitingStates', waitingStates =>
        waitingStates.set(payload.name, payload.waiting)
      )
  }

  return state
}
