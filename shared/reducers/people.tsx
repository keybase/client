import * as Types from '../constants/types/people'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as Constants from '../constants/people'
import * as PeopleGen from '../actions/people-gen'
import teamBuildingReducer from './team-building'

const initialState: Types.State = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action: PeopleGen.Actions | TeamBuildingGen.Actions
): Types.State {
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
    case PeopleGen.setResentEmail:
      return state.merge({
        resentEmail: action.payload.email,
      })
    case PeopleGen.getPeopleData:
    case PeopleGen.markViewed:
    case PeopleGen.skipTodo:
    case PeopleGen.dismissAnnouncement:
      return state
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
    case TeamBuildingGen.addUsersToTeamSoFar:
    case TeamBuildingGen.removeUsersFromTeamSoFar:
    case TeamBuildingGen.searchResultsLoaded:
    case TeamBuildingGen.finishedTeamBuilding:
    case TeamBuildingGen.fetchedUserRecs:
    case TeamBuildingGen.fetchUserRecs:
    case TeamBuildingGen.search:
    case TeamBuildingGen.selectRole:
    case TeamBuildingGen.labelsSeen:
    case TeamBuildingGen.changeSendNotification:
      return state.merge({
        teamBuilding: teamBuildingReducer('people', state.teamBuilding, action),
      })
    default:
      return state
  }
}
