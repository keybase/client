// @flow
// Used in the chat reducer
import * as I from 'immutable'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'

export default function<X, S: I.RecordOf<X & Types.TeamBuildingSubState>>(
  state: S,
  action: TeamBuildingGen.Actions
): S {
  switch (action.type) {
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
      return state.merge(Constants.makeSubState())
    case TeamBuildingGen.addUsersToTeamSoFar:
      return state.update('teamBuildingTeamSoFar', teamSoFar => teamSoFar.merge(action.payload.users))
    case TeamBuildingGen.removeUsersFromTeamSoFar: {
      const setToRemove = I.Set(action.payload.users)
      return state.update('teamBuildingTeamSoFar', teamSoFar => teamSoFar.filter(u => !setToRemove.has(u.id)))
    }
    case TeamBuildingGen.searchResultsLoaded: {
      const {query, service, users} = action.payload
      return state.update('teamBuildingSearchResults', searchResults =>
        searchResults.set(I.List([query, service]), users)
      )
    }
    case TeamBuildingGen.searchResultCountsLoaded: {
      const {query, counts} = action.payload
      return state.update('teamBuildingServiceResultCount', serviceResultCount =>
        serviceResultCount.set(query, I.Map(counts))
      )
    }
    case TeamBuildingGen.finishedTeamBuilding:
      return state.merge({
        teamBuildingFinishedTeam: state.teamBuildingTeamSoFar,
        teamBuildingTeamSoFar: I.Set(),
      })

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
