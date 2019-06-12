// Used in the chat reducer
import * as I from 'immutable'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {trim} from 'lodash-es'

export default function<
  X extends {
    teamBuilding: Types.TeamBuildingSubState
  }
>(state: I.RecordOf<X>, action: TeamBuildingGen.Actions): I.RecordOf<X> {
  switch (action.type) {
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
      return state.mergeIn(['teamBuilding'], Constants.makeSubState())
    case TeamBuildingGen.addUsersToTeamSoFar:
      return state.mergeIn(['teamBuilding', 'teamBuildingTeamSoFar'], I.Set(action.payload.users))
    case TeamBuildingGen.removeUsersFromTeamSoFar: {
      const setToRemove = I.Set(action.payload.users)
      return state.updateIn(['teambuilding', 'teamBuildingTeamSoFar'], teamSoFar =>
        teamSoFar.filter(u => !setToRemove.has(u.id))
      )
    }
    case TeamBuildingGen.searchResultsLoaded: {
      const {query, service, users} = action.payload
      // @ts-ignore tricky when we traverse into map types
      return state.mergeIn(['teamBuilding', 'teamBuildingSearchResults', query], {[service]: users})
    }
    case TeamBuildingGen.finishedTeamBuilding:
      return state.mergeIn<'teamBuilding', X['teamBuilding']>(['teamBuilding'], {
        teamBuildingTeamSoFar: I.Set<Types.User>(),
      })

    case TeamBuildingGen.fetchedUserRecs:
      return state.mergeIn<'teamBuilding'>(['teamBuilding' as const], {
        teamBuildingUserRecs: action.payload.users,
      })

    case TeamBuildingGen.search: {
      const {query, service, limit = state.teamBuilding.teamBuildingSearchLimit} = action.payload
      return state.mergeIn(['teamBuilding'], {
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
