import * as TeamsGen from '../actions/teams-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/teams'
import {isPhone} from '../constants/platform'
import * as Types from '../constants/types/teams'
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
  [TeamsGen.setTeamInviteError]: (draftState, action) => {
    draftState.errorInTeamInvite = action.payload.error
  },
  [TeamsGen.setTeamJoinError]: (draftState, action) => {
    draftState.errorInTeamJoin = action.payload.error
  },
  [TeamsGen.setTeamJoinSuccess]: (draftState, action) => {
    draftState.teamJoinSuccess = action.payload.success
    draftState.teamJoinSuccessOpen = action.payload.open
    draftState.teamJoinSuccessTeamName = action.payload.teamname
  },
  [TeamsGen.joinTeam]: draftState => {
    draftState.teamInviteDetails.inviteDetails = undefined
  },
  [TeamsGen.openInviteLink]: (draftState, action) => {
    draftState.teamInviteDetails.inviteDetails = undefined
    draftState.teamInviteDetails.inviteID = action.payload.inviteID
    draftState.teamInviteDetails.inviteKey = action.payload.inviteKey
  },
  [TeamsGen.updateInviteLinkDetails]: (draftState, action) => {
    draftState.teamInviteDetails.inviteDetails = action.payload.details
  },
  [TeamsGen.setTeamRetentionPolicy]: (draftState, action) => {
    draftState.teamIDToRetentionPolicy.set(action.payload.teamID, action.payload.retentionPolicy)
  },
  [TeamsGen.setTeamVersion]: (draftState, action) => {
    const {teamID, version} = action.payload
    draftState.teamVersion.set(
      teamID,
      Constants.ratchetTeamVersion(version, draftState.teamVersion.get(teamID))
    )
  },
  [TeamsGen.setTeamAccessRequestsPending]: (draftState, action) => {
    draftState.teamAccessRequestsPending = action.payload.accessRequestsPending
  },
  [TeamsGen.setTeamProfileAddList]: (draftState, action) => {
    draftState.teamProfileAddList = action.payload.teamlist
  },
  [TeamsGen.setTeamRoleMapLatestKnownVersion]: (draftState, action) => {
    draftState.teamRoleMap.latestKnownVersion = action.payload.version
  },
  [TeamsGen.setTeamRoleMap]: (draftState, action) => {
    draftState.teamRoleMap = {
      latestKnownVersion: Math.max(
        action.payload.map.latestKnownVersion,
        draftState.teamRoleMap.latestKnownVersion
      ),
      loadedVersion: action.payload.map.loadedVersion,
      roles: action.payload.map.roles,
    }
  },
  [TeamsGen.setMemberActivityDetails]: (draftState, action) => {
    action.payload.activityMap.forEach((lastActivity, teamID) => {
      if (!draftState.teamMemberToLastActivity.has(teamID)) {
        draftState.teamMemberToLastActivity.set(teamID, new Map())
      }
      draftState.teamMemberToLastActivity.get(teamID)?.set(action.payload.username, lastActivity)
    })
  },
  [TeamsGen.launchNewTeamWizardOrModal]: (draftState, action) => {
    draftState.newTeamWizard = {
      ...Constants.newTeamWizardEmptyState,
      parentTeamID: action.payload.subteamOf,
      teamType: 'subteam',
    }
  },
  [TeamsGen.setTeamWizardTeamType]: (draftState, action) => {
    draftState.newTeamWizard.teamType = action.payload.teamType
  },
  [TeamsGen.setTeamWizardNameDescription]: (draftState, action) => {
    draftState.newTeamWizard.name = action.payload.teamname
    draftState.newTeamWizard.description = action.payload.description
    draftState.newTeamWizard.open = action.payload.openTeam
    draftState.newTeamWizard.openTeamJoinRole = action.payload.openTeamJoinRole
    draftState.newTeamWizard.profileShowcase = action.payload.profileShowcase
    draftState.newTeamWizard.addYourself = action.payload.addYourself
  },
  [TeamsGen.setTeamWizardAvatar]: (draftState, action) => {
    draftState.newTeamWizard.avatarCrop = action.payload.crop
    draftState.newTeamWizard.avatarFilename = action.payload.filename
  },
  [TeamsGen.setTeamWizardTeamSize]: (draftState, action) => {
    draftState.newTeamWizard.isBig = action.payload.isBig
  },
  [TeamsGen.setTeamWizardChannels]: (draftState, action) => {
    draftState.newTeamWizard.channels = action.payload.channels
  },
  [TeamsGen.setTeamWizardSubteams]: (draftState, action) => {
    draftState.newTeamWizard.subteams = action.payload.subteams
  },
  [TeamsGen.setTeamWizardSubteamMembers]: (draftState, action) => {
    const {members} = action.payload
    draftState.addMembersWizard = {
      ...Constants.addMembersWizardEmptyState,
      addingMembers: members.map(m => ({assertion: m, role: 'writer'})),
      teamID: Types.newTeamWizardTeamID,
    }
  },
  [TeamsGen.setTeamWizardError]: (draftState, action) => {
    draftState.newTeamWizard.error = action.payload.error
  },
  [TeamsGen.startAddMembersWizard]: (draftState, action) => {
    const {teamID} = action.payload
    draftState.addMembersWizard = {...Constants.addMembersWizardEmptyState, teamID}
  },
  [TeamsGen.setAddMembersWizardRole]: (draftState, action) => {
    const {role} = action.payload
    draftState.addMembersWizard.role = role
    if (role !== 'setIndividually') {
      // keep roles stored with indiv members in sync with top level one
      draftState.addMembersWizard.addingMembers.forEach(member => {
        member.role = role
      })
    }
  },
  [TeamsGen.setAddMembersWizardIndividualRole]: (draftState, action) => {
    const {assertion, role} = action.payload
    const maybeMember = draftState.addMembersWizard.addingMembers.find(m => m.assertion === assertion)
    if (maybeMember) {
      maybeMember.role = role
    }
  },
  [TeamsGen.setJustFinishedAddMembersWizard]: (draftState, action) => {
    draftState.addMembersWizard.justFinished = action.payload.justFinished
  },
  [TeamsGen.addMembersWizardAddMembers]: (draftState, action) => {
    const {members} = action.payload
    const assertionsInTeam = new Set(action.payload.assertionsInTeam)

    // Set `membersAlreadyInTeam` first. It's only shown for last add, so
    // just overwrite the list.
    //
    // Prefer to show "resolvedFrom" which will contain the original assertion
    // that user tried to add (e.g. phone number or email) in case it resolved
    // to a user that's already in the team.
    draftState.addMembersWizard.membersAlreadyInTeam = members
      .filter(m => assertionsInTeam.has(m.assertion))
      .map(m => m.resolvedFrom ?? m.assertion)

    // - Filter out all members that are already in team as team members or
    //   team invites.
    // - De-duplicate with current addingMembers list
    // - Coerce assertion role (ensures it's no higher than 'writer' for
    //   non-usernames).
    const filteredMembers = members.filter(m => !assertionsInTeam.has(m.assertion))
    draftState.addMembersWizard.addingMembers = Constants.dedupAddingMembeers(
      draftState.addMembersWizard.addingMembers,
      filteredMembers.map(Constants.coerceAssertionRole)
    )

    // Check if after adding the new batch of members we are not violating the
    // "only Keybase users can be added as admins" contract.
    if (
      ['admin', 'owner'].includes(draftState.addMembersWizard.role) &&
      filteredMembers.some(m => m.assertion.includes('@'))
    ) {
      if (isPhone) {
        draftState.addMembersWizard.role = 'writer'
        draftState.addMembersWizard.addingMembers.forEach(member => (member.role = 'writer'))
      } else {
        draftState.addMembersWizard.role = 'setIndividually'
      }
    }
  },
  [TeamsGen.addMembersWizardRemoveMember]: (draftState, action) => {
    const {assertion} = action.payload
    const idx = draftState.addMembersWizard.addingMembers.findIndex(member => member.assertion === assertion)
    if (idx >= 0) {
      draftState.addMembersWizard.addingMembers.splice(idx, 1)
    }
  },
  [TeamsGen.cancelAddMembersWizard]: draftState => {
    draftState.addMembersWizard = {...Constants.addMembersWizardEmptyState}
  },
  [TeamsGen.finishedAddMembersWizard]: draftState => {
    draftState.addMembersWizard = {...Constants.addMembersWizardEmptyState, justFinished: true}
  },
  [TeamsGen.finishNewTeamWizard]: draftState => {
    draftState.newTeamWizard.error = undefined
  },
  [TeamsGen.finishedNewTeamWizard]: draftState => {
    draftState.newTeamWizard = Constants.newTeamWizardEmptyState
    draftState.addMembersWizard = {...Constants.addMembersWizardEmptyState, justFinished: true}
  },
  [TeamsGen.addMembersWizardSetDefaultChannels]: (draftState, action) => {
    const {toAdd, toRemove} = action.payload
    if (!draftState.addMembersWizard.addToChannels) {
      // we're definitely setting these manually now
      draftState.addMembersWizard.addToChannels = []
    }
    const addToChannels = draftState.addMembersWizard.addToChannels
    toAdd?.forEach(channel => {
      if (!addToChannels.find(dc => dc.conversationIDKey === channel.conversationIDKey)) {
        addToChannels?.push(channel)
      }
    })
    const maybeRemoveIdx =
      (toRemove && addToChannels.findIndex(dc => dc.conversationIDKey === toRemove.conversationIDKey)) ?? -1
    if (maybeRemoveIdx >= 0) {
      addToChannels.splice(maybeRemoveIdx, 1)
    }
  },
  [TeamsGen.setTeamListFilterSort]: (draftState, action) => {
    const {filter, sortOrder} = action.payload
    if (filter !== undefined) {
      draftState.teamListFilter = filter
    }
    if (sortOrder !== undefined) {
      draftState.teamListSort = sortOrder
    }
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
