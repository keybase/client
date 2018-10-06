// @flow
// Used in the chat reducer
import * as I from 'immutable'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {trim} from 'lodash-es'

export default function<X, S: I.RecordOf<X & Types.TeamBuildingSubState>>(
  state: S,
  action: TeamBuildingGen.Actions
): S {
  switch (action.type) {
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
      return state.merge(Constants.makeSubState())
    case TeamBuildingGen.addUsersToTeamSoFar:
      return state.mergeIn(['teamBuildingTeamSoFar'], action.payload.users)
    case TeamBuildingGen.removeUsersFromTeamSoFar: {
      const setToRemove = I.Set(action.payload.users)
      return state.update('teamBuildingTeamSoFar', teamSoFar => teamSoFar.filter(u => !setToRemove.has(u.id)))
    }
    case TeamBuildingGen.searchResultsLoaded: {
      const {query, service, users} = action.payload
      return state.mergeIn(['teamBuildingSearchResults', query], {[service]: users})
    }
    case TeamBuildingGen.finishedTeamBuilding:
      return state.merge({
        teamBuildingFinishedTeam: state.teamBuildingTeamSoFar,
        teamBuildingTeamSoFar: I.Set(),
      })

    case TeamBuildingGen.search: {
      const {query, service, limit = state.teamBuildingSearchLimit} = action.payload
      return state.merge({
        teamBuildingSearchQuery: trim(query),
        teamBuildingSelectedService: service,
        teamBuildingSearchLimit: limit,
      })
    }

    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
