import * as Container from '../util/container'
import {mapGetEnsureValue} from '../util/map'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import trim from 'lodash/trim'

const initialState = Constants.makeSubState()

const reducer = Container.makeReducer<TeamBuildingGen.Actions, Types.TeamBuildingSubState>(initialState, {
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
    const old = mapGetEnsureValue(results, service, [])
    old.push(...users)
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
    const {query, service, limit = draftState.searchLimit} = action.payload
    draftState.searchLimit = limit
    draftState.searchQuery = trim(query)
    draftState.selectedService = service
  },
})

export default function(
  namespace: string,
  state: Container.Draft<Types.TeamBuildingSubState>,
  action: TeamBuildingGen.Actions
) {
  if (action.type === TeamBuildingGen.resetStore || action.type === TeamBuildingGen.tbResetStore) {
    return Constants.makeSubState()
  }

  if (action.payload.namespace !== namespace) {
    return
  }

  return reducer(state, action)
}
