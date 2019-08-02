// Used in the chat reducer
import * as I from 'immutable'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {trim} from 'lodash-es'

export default function(
  namespace: string,
  state: Types.TeamBuildingSubState,
  action: TeamBuildingGen.Actions
): Types.TeamBuildingSubState {
  if (action.type === TeamBuildingGen.resetStore) {
    return Constants.makeSubState()
  }

  if (action.payload.namespace !== namespace) {
    return state
  }

  switch (action.type) {
    case TeamBuildingGen.cancelTeamBuilding:
      return Constants.makeSubState()
    case TeamBuildingGen.selectRole:
      return state.set('teamBuildingSelectedRole', action.payload.role)
    case TeamBuildingGen.changeSendNotification:
      return state.set('teamBuildingSendNotification', action.payload.sendNotification)
    case TeamBuildingGen.addUsersToTeamSoFar:
      return state.mergeIn(['teamBuildingTeamSoFar'], I.Set(action.payload.users))
    case TeamBuildingGen.removeUsersFromTeamSoFar: {
      const setToRemove = I.Set(action.payload.users)
      return state.update('teamBuildingTeamSoFar', teamSoFar => teamSoFar.filter(u => !setToRemove.has(u.id)))
    }
    case TeamBuildingGen.searchResultsLoaded: {
      const {query, service, users} = action.payload
      // @ts-ignore tricky when we traverse into map types
      return state.mergeIn(['teamBuildingSearchResults', query], {[service]: users})
    }
    case TeamBuildingGen.finishedTeamBuilding: {
      const initialState = Constants.makeSubState()
      return state.merge({
        teamBuildingFinishedSelectedRole: state.teamBuildingSelectedRole,
        teamBuildingFinishedSendNotification: state.teamBuildingSendNotification,
        teamBuildingFinishedTeam: state.teamBuildingTeamSoFar,
        teamBuildingSelectedRole: initialState.teamBuildingSelectedRole,
        teamBuildingSendNotification: initialState.teamBuildingSendNotification,
        teamBuildingTeamSoFar: initialState.teamBuildingTeamSoFar,
      })
    }
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
      return state
  }
}
