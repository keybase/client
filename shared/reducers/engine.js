// @flow
import * as Constants from '../constants/engine'
import * as CommonConstants from '../constants/common'

const initialState: Constants.State = {
  rpcWaitingStates: {},
}

export default function(state: Constants.State = initialState, action: Constants.Actions) {
  if (action.type === CommonConstants.resetStore) {
    return {...initialState}
  }

  if (action.type === 'engine:waitingForRpc') {
    return state.update('rpcWaitingStates', waitingStates =>
      waitingStates.set(action.payload.rpcName, action.payload.waiting)
    )
  }

  return state
}
