// @flow
import * as Constants from '../constants/engine'
import * as CommonConstants from '../constants/common'

const initialState: Constants.State = Constants.StateRecord()

export default function(state: Constants.State = initialState, action: Constants.Actions) {
  if (action.type === CommonConstants.resetStore) {
    return {...initialState}
  }

  if (action.type === 'engine:waitingForRpc') {
    const payload = action.payload
    // $FlowIssue updating records
    return state.update('rpcWaitingStates', waitingStates =>
      waitingStates.set(payload.rpcName, payload.waiting)
    )
  }

  return state
}
