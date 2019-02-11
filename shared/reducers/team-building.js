// @flow
// Used in the chat reducer
import * as I from 'immutable'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {trim} from 'lodash-es'
import * as Flow from '../util/flow'

export default function<X: Object, S: I.RecordOf<X & Types.TeamBuildingSubState>>(
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

    case TeamBuildingGen.fetchedUserRecs:
      return state.merge({
        teamBuildingUserRecs: action.payload.users,
      })

    case TeamBuildingGen.search: {
      const {query, service, limit = state.teamBuildingSearchLimit} = action.payload
      return state.merge({
        teamBuildingSearchLimit: limit,
        teamBuildingSearchQuery: trim(query),
        teamBuildingSelectedService: service,
      })
    }

    case TeamBuildingGen.fetchUserRecs:
      return state

    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
