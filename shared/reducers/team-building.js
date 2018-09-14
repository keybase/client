// @flow
// Used in the chat reducer
import * as I from 'immutable'
import * as ChatTypes from '../constants/types/chat2'
import * as TeamBuildingGen from '../actions/team-building-gen'

// Uses ChatState and relies on these fields exisitng
// teamBuildingTeamSoFar: I.Set<TeamBuildingTypes.User>,
// teamBuildingSearchResults: TeamBuildingTypes.SearchResults,
// teamBuildingServiceResultCount: TeamBuildingTypes.ServiceResultCount,
// teamBuildingFinishedTeam: I.Set<TeamBuildingTypes.User>,

export default function(state: ChatTypes.State, action: TeamBuildingGen.Actions) {
  switch (action.type) {
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
      return state.merge({
        teamBuildingTeamSoFar: I.Set(),
        teamBuildingSearchResults: I.Map(),
        teamBuildingServiceResultCount: I.Map(),
        teamBuildingFinishedTeam: I.Set(),
      })
    case TeamBuildingGen.addUsersToTeamSoFar:
      return state.update('teamBuildingTeamSoFar', teamSoFar => teamSoFar.merge(action.payload.users))
    case TeamBuildingGen.removeUsersFromTeamSoFar: {
      const setToRemove = I.Set(action.payload.users)

      return state.update('teamBuildingTeamSoFar', teamSoFar => teamSoFar.filter(u => !setToRemove.has(u.id)))
    }
    case TeamBuildingGen.searchResultsLoaded: {
      const {query, service, users} = action.payload
      return state.update('teamBuildingSearchResults', searchResults =>
        // Clear this so we don't keep stale data. Caching should be handled in saga.
        searchResults.clear().set(I.List([query, service]), users)
      )
    }
    case TeamBuildingGen.searchResultCountsLoaded: {
      const {query, counts} = action.payload
      return state.update('teamBuildingServiceResultCount', serviceResultCount =>
        // Clear this so we don't keep stale data. Caching should be handled in saga.
        serviceResultCount.clear().set(query, I.Map(counts))
      )
    }
    case TeamBuildingGen.finishedTeamBuilding:
      return state
        .set('teamBuildingFinishedTeam', state.teamBuildingTeamSoFar)
        .set('teamBuildingTeamSoFar', I.Set())

    // Saga only actions
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
