import * as Container from '../util/container'
import * as TeamBuildingConstants from '../constants/team-building'
import type * as TeamBuildingGen from '../actions/team-building-gen'
import type * as Types from '../constants/types/people'
import {editTeambuildingDraft} from './team-building'
import {teamBuilderReducerCreator} from '../team-building/reducer-helper'

const initialState: Types.State = {
  teamBuilding: TeamBuildingConstants.makeSubState(),
}

type Actions = TeamBuildingGen.Actions

// Encrypt: Handle team building when selecting keybase users
export default Container.makeReducer<Actions, Types.State>(initialState, {
  ['common:resetStore']: () => {},
  ...teamBuilderReducerCreator<Types.State>(
    (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
      const val = editTeambuildingDraft('people', draftState.teamBuilding, action)
      if (val !== undefined) {
        draftState.teamBuilding = val
      }
    }
  ),
})
