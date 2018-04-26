// @flow
import * as Types from '../constants/types/people'
import * as Constants from '../constants/people'
import * as PeopleGen from '../actions/people-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: PeopleGen.Actions) {
  switch (action.type) {
    case PeopleGen.resetStore:
      return initialState
    case PeopleGen.peopleDataProcessed:
      return state
        .set('lastViewed', action.payload.lastViewed)
        .set('oldItems', action.payload.oldItems)
        .set('newItems', action.payload.newItems)
        .set('followSuggestions', action.payload.followSuggestions)
        .set('version', action.payload.version)
    case PeopleGen.getPeopleData:
    case PeopleGen.markViewed:
    case PeopleGen.skipTodo:
    case PeopleGen.setupPeopleHandlers:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
