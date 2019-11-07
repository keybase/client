import * as Types from '../constants/types/people'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as TeamBuildingConstants from '../constants/team-building'
import * as PeopleGen from '../actions/people-gen'
import * as Container from '../util/container'
import * as SettingsGen from '../actions/settings-gen'
import teamBuildingReducer from './team-building'

const initialState: Types.State = {
  followSuggestions: [],
  lastViewed: new Date(),
  newItems: [],
  oldItems: [],
  resentEmail: '',
  teamBuilding: TeamBuildingConstants.makeSubState(),
  version: -1,
}

type Actions = PeopleGen.Actions | TeamBuildingGen.Actions | SettingsGen.EmailVerifiedPayload

const passToTeamBuildingReducer = (
  draftState: Container.Draft<Types.State>,
  action: TeamBuildingGen.Actions
) => {
  draftState.teamBuilding = teamBuildingReducer(
    'people',
    draftState.teamBuilding as Types.State['teamBuilding'],
    action
  )
}

const teamActions: Container.ActionHandler<Actions, Types.State> = {
  [TeamBuildingGen.resetStore]: passToTeamBuildingReducer,
  [TeamBuildingGen.cancelTeamBuilding]: passToTeamBuildingReducer,
  [TeamBuildingGen.addUsersToTeamSoFar]: passToTeamBuildingReducer,
  [TeamBuildingGen.removeUsersFromTeamSoFar]: passToTeamBuildingReducer,
  [TeamBuildingGen.searchResultsLoaded]: passToTeamBuildingReducer,
  [TeamBuildingGen.finishedTeamBuilding]: passToTeamBuildingReducer,
  [TeamBuildingGen.fetchedUserRecs]: passToTeamBuildingReducer,
  [TeamBuildingGen.fetchUserRecs]: passToTeamBuildingReducer,
  [TeamBuildingGen.search]: passToTeamBuildingReducer,
  [TeamBuildingGen.selectRole]: passToTeamBuildingReducer,
  [TeamBuildingGen.labelsSeen]: passToTeamBuildingReducer,
  [TeamBuildingGen.changeSendNotification]: passToTeamBuildingReducer,
}

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [PeopleGen.resetStore]: () => initialState,
  [PeopleGen.peopleDataProcessed]: (draftState, action) => {
    const {payload} = action
    draftState.followSuggestions = payload.followSuggestions
    draftState.lastViewed = payload.lastViewed
    draftState.newItems = payload.newItems
    draftState.oldItems = payload.oldItems
    draftState.version = payload.version
  },
  [PeopleGen.setResentEmail]: (draftState, action) => {
    draftState.resentEmail = action.payload.email
  },
  [SettingsGen.emailVerified]: draftState => {
    draftState.resentEmail = ''
  },
  ...teamActions,
})
