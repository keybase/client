// @flow
import * as DevGen from '../actions/dev-gen'
import * as Constants from '../constants/dev'
import * as Types from '../constants/types/dev'

export default function(state: Types.State = Constants.initialState, action: DevGen.Actions) {
  switch (action.type) {
    case DevGen.resetStore:
      return {...Constants.initialState}
    case DevGen.updateDebugConfig:
      const {dumbFilter, dumbFullscreen, dumbIndex} = action.payload
      return {
        ...state,
        dumbFilter,
        dumbFullscreen,
        dumbIndex,
      }
    case DevGen.debugCount:
      return {
        ...state,
        debugCount: state.debugCount + 1,
      }
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
