import type * as Container from '../util/container'
import {mapGetEnsureValue} from '../util/map'
import * as Constants from '../constants/team-building'
import type * as Types from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import type {ActionHandler} from '../util/make-reducer'
import trim from 'lodash/trim'

const initialState = Constants.makeSubState()

export const editTeambuildingDraft = (
  namespace: string,
  state: Container.Draft<Types.TeamBuildingSubState>,
  _action: TeamBuildingGen.Actions
) => {
  if (_action.type === TeamBuildingGen.resetStore || _action.type === TeamBuildingGen.tbResetStore) {
    return Constants.makeSubState()
  }

  if (_action.payload.namespace !== namespace) {
    return
  }

  const reducer: ActionHandler<TeamBuildingGen.Actions, Types.TeamBuildingSubState> = {
    [TeamBuildingGen.cancelTeamBuilding]: () => Constants.makeSubState(),
    [TeamBuildingGen.selectRole]: (draftState, action) => {
      draftState.selectedRole = action.payload.role
    },
    [TeamBuildingGen.changeSendNotification]: (draftState, action) => {
      draftState.sendNotification = action.payload.sendNotification
    },
    [TeamBuildingGen.addUsersToTeamSoFar]: (draftState, action) => {
      draftState.teamSoFar = new Set([...draftState.teamSoFar, ...action.payload.users])
    },
    [TeamBuildingGen.removeUsersFromTeamSoFar]: (draftState, action) => {
      const setToRemove = new Set(action.payload.users)
      draftState.teamSoFar = new Set([...draftState.teamSoFar].filter(u => !setToRemove.has(u.id)))
    },
    [TeamBuildingGen.searchResultsLoaded]: (draftState, action) => {
      const {query, service, users} = action.payload
      const results = mapGetEnsureValue(draftState.searchResults, query, new Map())
      results.set(service, users)
    },
    [TeamBuildingGen.finishTeamBuilding]: draftState => {
      draftState.error = ''
    },
    [TeamBuildingGen.setError]: (draftState, action) => {
      draftState.error = action.payload.error
    },
    [TeamBuildingGen.finishedTeamBuilding]: draftState => {
      return {
        ...Constants.makeSubState(),
        finishedSelectedRole: draftState.selectedRole,
        finishedSendNotification: draftState.sendNotification,
        finishedTeam: draftState.teamSoFar,
        selectedRole: initialState.selectedRole,
        sendNotification: initialState.sendNotification,
        teamSoFar: initialState.teamSoFar,
      }
    },
    [TeamBuildingGen.fetchedUserRecs]: (draftState, action) => {
      draftState.userRecs = action.payload.users
    },
    [TeamBuildingGen.search]: (draftState, action) => {
      const {query, service, limit} = action.payload
      draftState.searchLimit = limit ?? 11
      draftState.searchQuery = trim(query)
      draftState.selectedService = service
    },
  }

  const call = reducer[_action.type]
  if (call) {
    // @ts-ignore
    return call(state, _action)
  } else return
}
