// @flow
import * as DevGen from '../actions/dev-gen'
import * as Constants from '../constants/dev'
import * as Types from '../constants/types/dev'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: DevGen.Actions) {
  switch (action.type) {
    case DevGen.resetStore:
      return initialState
    case DevGen.updateDebugConfig: {
      const {dumbFilter, dumbFullscreen, dumbIndex} = action.payload
      return state
        .set('dumbFilter', dumbFilter)
        .set('dumbFullscreen', dumbFullscreen)
        .set('dumbIndex', dumbIndex)
    }
    case DevGen.debugCount:
      return state.set('debugCount', state.debugCount + 1)
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
