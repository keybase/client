import * as Types from '../constants/types/gregor'
import * as Constants from '../constants/gregor'
import * as GregorGen from '../actions/gregor-gen'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: GregorGen.Actions): Types.State {
  switch (action.type) {
    case GregorGen.resetStore:
      return initialState
    case GregorGen.updateReachable:
      return state.merge({reachable: action.payload.reachable})
    // Saga only actions
    case GregorGen.checkReachability:
    case GregorGen.pushOOBM:
    case GregorGen.pushState:
    case GregorGen.updateCategory:
      return state
    default:
      return state
  }
}
