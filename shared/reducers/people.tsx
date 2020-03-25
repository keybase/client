import * as Container from '../util/container'
import * as EngineGen from '../actions/engine-gen-gen'
import * as PeopleGen from '../actions/people-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as TeamBuildingConstants from '../constants/team-building'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as Types from '../constants/types/people'
import {editTeambuildingDraft} from './team-building'
import shallowEqual from 'shallowequal'
import {teamBuilderReducerCreator} from '../team-building/reducer-helper'

const initialState: Types.State = {
  followSuggestions: [],
  inviteCounts: null,
  lastViewed: new Date(),
  newItems: [],
  oldItems: [],
  resentEmail: '',
  teamBuilding: TeamBuildingConstants.makeSubState(),
  version: -1,
  wotUpdates: new Map<string, Types.WotUpdate>(),
}

type Actions =
  | PeopleGen.Actions
  | TeamBuildingGen.Actions
  | SettingsGen.EmailVerifiedPayload
  | EngineGen.Keybase1NotifyInviteFriendsUpdateInviteCountsPayload

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [PeopleGen.resetStore]: () => initialState,
  [PeopleGen.peopleDataProcessed]: (draftState, action) => {
    const {payload} = action
    const {followSuggestions, lastViewed, newItems, oldItems, version} = payload
    if (!shallowEqual(followSuggestions, draftState.followSuggestions)) {
      draftState.followSuggestions = followSuggestions
    }
    if (lastViewed.getTime() !== draftState.lastViewed.getTime()) {
      draftState.lastViewed = lastViewed
    }
    if (!shallowEqual(newItems, draftState.newItems)) {
      draftState.newItems = newItems
    }
    if (!shallowEqual(oldItems, draftState.oldItems)) {
      draftState.oldItems = oldItems
    }
    draftState.version = version
  },
  [PeopleGen.badgeAppForWotNotifications]: (draftState, action) => {
    draftState.wotUpdates = action.payload.updates
  },
  [PeopleGen.setResentEmail]: (draftState, action) => {
    draftState.resentEmail = action.payload.email
  },
  [SettingsGen.emailVerified]: draftState => {
    draftState.resentEmail = ''
  },
  [EngineGen.keybase1NotifyInviteFriendsUpdateInviteCounts]: (draftState, action) => {
    draftState.inviteCounts = action.payload.params.counts
  },
  ...teamBuilderReducerCreator<Types.State>(
    (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
      const val = editTeambuildingDraft('people', draftState.teamBuilding, action)
      if (val !== undefined) {
        draftState.teamBuilding = val
      }
    }
  ),
})
