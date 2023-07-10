import * as TeamsGen from '../actions/teams-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/teams'
import type * as Types from '../constants/types/teams'
import * as Container from '../util/container'
import {editTeambuildingDraft} from './team-building'
import {mapGetEnsureValue} from '../util/map'
import * as RPCTypes from '../constants/types/rpc-gen'

const initialState: Types.State = Constants.makeState()

const handleTeamBuilding = (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
  const val = editTeambuildingDraft('teams', draftState.teamBuilding, action)
  if (val !== undefined) {
    draftState.teamBuilding = val
  }
}

type EngineActions =
  | EngineGen.Keybase1NotifyTeamTeamTreeMembershipsPartialPayload
  | EngineGen.Keybase1NotifyTeamTeamTreeMembershipsDonePayload

type Actions = TeamsGen.Actions | TeamBuildingGen.Actions | EngineActions

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [TeamsGen.resetStore]: () => {
    return initialState
  },
  [TeamsGen.setMembers]: (draftState, action) => {
    draftState.teamIDToMembers.set(action.payload.teamID, action.payload.members)
  },
  [TeamsGen.setTeamRetentionPolicy]: (draftState, action) => {
    draftState.teamIDToRetentionPolicy.set(action.payload.teamID, action.payload.retentionPolicy)
  },
  [TeamsGen.setTeamProfileAddList]: (draftState, action) => {
    draftState.teamProfileAddList = action.payload.teamlist
  },
  [TeamsGen.setMemberActivityDetails]: (draftState, action) => {
    action.payload.activityMap.forEach((lastActivity, teamID) => {
      if (!draftState.teamMemberToLastActivity.has(teamID)) {
        draftState.teamMemberToLastActivity.set(teamID, new Map())
      }
      draftState.teamMemberToLastActivity.get(teamID)?.set(action.payload.username, lastActivity)
    })
  },
  [TeamBuildingGen.tbResetStore]: handleTeamBuilding,
  [TeamBuildingGen.cancelTeamBuilding]: handleTeamBuilding,
  [TeamBuildingGen.addUsersToTeamSoFar]: handleTeamBuilding,
  [TeamBuildingGen.removeUsersFromTeamSoFar]: handleTeamBuilding,
  [TeamBuildingGen.searchResultsLoaded]: handleTeamBuilding,
  [TeamBuildingGen.finishedTeamBuilding]: handleTeamBuilding,
  [TeamBuildingGen.fetchedUserRecs]: handleTeamBuilding,
  [TeamBuildingGen.fetchUserRecs]: handleTeamBuilding,
  [TeamBuildingGen.search]: handleTeamBuilding,
  [TeamBuildingGen.selectRole]: handleTeamBuilding,
  [TeamBuildingGen.labelsSeen]: handleTeamBuilding,
  [TeamBuildingGen.changeSendNotification]: handleTeamBuilding,
  [TeamBuildingGen.finishTeamBuilding]: handleTeamBuilding,
  [TeamBuildingGen.setError]: handleTeamBuilding,
  [EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial]: (draftState, action) => {
    const {membership} = action.payload.params
    const {guid, targetTeamID, targetUsername} = membership

    const usernameMemberships = mapGetEnsureValue(
      draftState.teamMemberToTreeMemberships,
      targetTeamID,
      new Map()
    )

    let memberships = usernameMemberships.get(targetUsername)
    if (memberships && guid < memberships.guid) {
      // noop
      return
    }
    if (!memberships || guid > memberships.guid) {
      // start over
      memberships = {
        guid,
        memberships: [],
        targetTeamID,
        targetUsername,
      }
      usernameMemberships.set(targetUsername, memberships)
    }
    memberships.memberships.push(membership)

    if (RPCTypes.TeamTreeMembershipStatus.ok == membership.result.s) {
      const value = membership.result.ok
      const sparseMemberInfos = mapGetEnsureValue(
        draftState.treeLoaderTeamIDToSparseMemberInfos,
        value.teamID,
        new Map()
      )
      sparseMemberInfos.set(targetUsername, Constants.consumeTeamTreeMembershipValue(value))
    }
  },
  [EngineGen.keybase1NotifyTeamTeamTreeMembershipsDone]: (draftState, action) => {
    const {result} = action.payload.params
    const {guid, targetTeamID, targetUsername, expectedCount} = result

    const usernameMemberships = mapGetEnsureValue(
      draftState.teamMemberToTreeMemberships,
      targetTeamID,
      new Map()
    )

    let memberships = usernameMemberships.get(targetUsername)
    if (memberships && guid < memberships.guid) {
      // noop
      return
    }
    if (!memberships || guid > memberships.guid) {
      // start over
      memberships = {
        guid,
        memberships: [],
        targetTeamID,
        targetUsername,
      }
      usernameMemberships.set(targetUsername, memberships)
    }
    memberships.expectedCount = expectedCount
  },
})
