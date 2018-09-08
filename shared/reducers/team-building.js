// @flow
// Used in the chat reducer
import * as I from 'immutable'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as Types from '../constants/types/chat2'
import * as ChatTypes from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'

// TeamBuildingTeamSoFar: I.Set<TeamBuildingTypes.UserID>,
// TeamBuildingSearchResults: TeamBuildingTypes.SearchResults,
// TeamBuildingServiceResultCount: TeamBuildingTypes.ServiceResultCount,

export default function(state: ChatTypes.State, action: TeamBuildingGen.Actions) {
  switch (action.type) {
    case TeamBuildingGen.addUsersToTeamSoFar:
      return state.update('TeamBuildingTeamSoFar', teamSoFar => teamSoFar.merge(action.payload.users))
    case TeamBuildingGen.removeUsersFromTeamSoFar:
      return state.update('TeamBuildingTeamSoFar', teamSoFar => teamSoFar.subtract(action.payload.users))
    case TeamBuildingGen.searchResultsLoaded: {
      const {query, service, users} = action.payload
      return state.update('TeamBuildingSearchResults', searchResults =>
        // Clear this so we don't keep stale data. Caching should be handled in saga.
        searchResults.clear().set(I.List([query, service]), users)
      )
    }
    case TeamBuildingGen.searchResultCountsLoaded: {
      const {query, service, users} = action.payload
      return state.update('TeamBuildingSearchResults', searchResults =>
        // Clear this so we don't keep stale data. Caching should be handled in saga.
        searchResults.clear().set(I.List([query, service]), users)
      )
    }
    // Saga only actions
    case TeamBuildingGen.finishedTeamBuilding:
    case TeamBuildingGen.search:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
