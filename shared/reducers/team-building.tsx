// Used in the chat reducer
import * as I from 'immutable'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {trim} from 'lodash-es'

export default function<X>(
  state: I.RecordOf<X & Types.TeamBuildingSubState>,
  action: TeamBuildingGen.Actions
): I.RecordOf<X & Types.TeamBuildingSubState> {
  switch (action.type) {
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
      // @ts-ignore investigate
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
      // @ts-ignore investigate
      return state.merge({
        teamBuildingFinishedTeam: state.teamBuildingTeamSoFar,
        teamBuildingTeamSoFar: I.Set<Types.User>(),
      })

    case TeamBuildingGen.fetchedUserRecs:
      // @ts-ignore todo(mm) investigate
      return state.merge({
        teamBuildingUserRecs: action.payload.users,
      })

    case TeamBuildingGen.search: {
      const {query, service, limit = state.teamBuildingSearchLimit} = action.payload
      // @ts-ignore todo(mm) investigate
      return state.merge({
        teamBuildingSearchLimit: limit,
        teamBuildingSearchQuery: trim(query),
        teamBuildingSelectedService: service,
      })
    }

    case TeamBuildingGen.fetchUserRecs:
      return state

    default:
      return state
  }
}
