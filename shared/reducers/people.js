// @flow
import * as Types from '../constants/types/people'
import * as Constants from '../constants/people'
import * as PeopleGen from '../actions/people-gen'
import * as Flow from '../util/flow'

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
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
