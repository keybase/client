// @flow
import * as Types from '../constants/types/people'
import * as Constants from '../constants/people'
import * as PeopleGen from '../actions/people-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: PeopleGen.Actions): Types.State {
  switch (action.type) {
    case PeopleGen.resetStore:
      return initialState
    case PeopleGen.peopleDataProcessed:
      return state.merge({
        followSuggestions: action.payload.followSuggestions,
        lastViewed: action.payload.lastViewed,
        newItems: action.payload.newItems,
        oldItems: action.payload.oldItems,
        version: action.payload.version,
      })
    case PeopleGen.getPeopleData:
    case PeopleGen.markViewed:
    case PeopleGen.skipTodo:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
