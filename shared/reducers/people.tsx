import * as Container from '../util/container'
import * as EngineGen from '../actions/engine-gen-gen'
import * as PeopleGen from '../actions/people-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as TeamBuildingConstants from '../constants/team-building'
import type * as TeamBuildingGen from '../actions/team-building-gen'
import type * as Types from '../constants/types/people'
import {editTeambuildingDraft} from './team-building'
import {teamBuilderReducerCreator} from '../team-building/reducer-helper'

const initialState: Types.State = {
  inviteCounts: undefined,
  resentEmail: '',
  teamBuilding: TeamBuildingConstants.makeSubState(),
  wotUpdates: new Map<string, Types.WotUpdate>(),
}

type Actions =
  | PeopleGen.Actions
  | TeamBuildingGen.Actions
  | SettingsGen.EmailVerifiedPayload
  | EngineGen.Keybase1NotifyInviteFriendsUpdateInviteCountsPayload

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [PeopleGen.resetStore]: () => initialState,
  [PeopleGen.badgeAppForWotNotifications]: (draftState, action) => {
    // quick skip
    if (draftState.wotUpdates.size || action.payload.updates.size) {
      draftState.wotUpdates = action.payload.updates
    }
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
