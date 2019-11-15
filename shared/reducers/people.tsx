import * as Types from '../constants/types/people'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as TeamBuildingConstants from '../constants/team-building'
import * as PeopleGen from '../actions/people-gen'
import * as Container from '../util/container'
import * as SettingsGen from '../actions/settings-gen'
import {teamBuilderReducerCreator} from '../team-building/reducer-helper'
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
  ...teamBuilderReducerCreator<Actions, Types.State>(
    (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
      teamBuildingReducer('people', draftState.teamBuilding, action)
    }
  ),
})
