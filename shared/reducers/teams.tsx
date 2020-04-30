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
  | EngineGen.Keybase1NotifyTeamTeamMetadataUpdatePayload
  | EngineGen.Chat1NotifyChatChatWelcomeMessageLoadedPayload
  | EngineGen.Keybase1NotifyTeamTeamTreeMembershipsPartialPayload
  | EngineGen.Keybase1NotifyTeamTeamTreeMembershipsDonePayload

type Actions = TeamsGen.Actions | TeamBuildingGen.Actions | EngineActions

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [TeamsGen.resetStore]: () => {
    return initialState
  },
  [TeamsGen.setChannelCreationError]: (draftState, action) => {
    draftState.creatingChannels = false
    draftState.errorInChannelCreation = action.payload.error
  },
  [TeamsGen.createChannels]: draftState => {
    draftState.creatingChannels = true
  },
  [TeamsGen.setCreatingChannels]: (draftState, action) => {
    draftState.creatingChannels = action.payload.creatingChannels
  },
  [TeamsGen.createNewTeam]: draftState => {
    draftState.errorInTeamCreation = ''
  },
  [TeamsGen.createNewTeamFromConversation]: draftState => {
    draftState.errorInTeamCreation = ''
  },
  [TeamsGen.teamCreated]: (draftState, action) => {
    draftState.teamNameToID.set(action.payload.teamname, action.payload.teamID)
  },
  [TeamsGen.setTeamCreationError]: (draftState, action) => {
    draftState.errorInTeamCreation = action.payload.error
  },
  [TeamsGen.clearAddUserToTeamsResults]: draftState => {
    draftState.addUserToTeamsResults = ''
    draftState.addUserToTeamsState = 'notStarted'
  },
  [TeamsGen.setAddUserToTeamsResults]: (draftState, action) => {
    draftState.addUserToTeamsResults = action.payload.results
    draftState.addUserToTeamsState = action.payload.error ? 'failed' : 'succeeded'
  },
  [TeamsGen.settingsError]: (draftState, action) => {
    draftState.errorInSettings = action.payload.error
  },
  [TeamsGen.addToTeam]: draftState => {
    draftState.errorInAddToTeam = ''
  },
  [TeamsGen.addedToTeam]: (draftState, action) => {
    draftState.errorInAddToTeam = action.payload.error ?? ''
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
  [TeamsGen.setTeamLoadingInvites]: (draftState, action) => {
    const {teamname, loadingKey, isLoading} = action.payload
    const oldLoadingInvites = mapGetEnsureValue(draftState.teamNameToLoadingInvites, teamname, new Map())
    oldLoadingInvites.set(loadingKey, isLoading)
    draftState.teamNameToLoadingInvites.set(teamname, oldLoadingInvites)
  },
  [TeamsGen.teamLoaded]: (draftState, action) => {
    const {teamID, team} = action.payload
    const maybeMeta = draftState.teamMeta.get(teamID)
    if (maybeMeta && maybeMeta.teamname !== team.name) {
      if (team.name.includes('.')) {
        // subteam name changed. store loaded name
        maybeMeta.teamname = team.name
      } else {
        // bad. teamlist lied to us about the teamname
        throw new Error('Team name mismatch! Please report this error.')
      }
    }

    const details = Constants.annotatedTeamToDetails(team)
    draftState.teamDetails.set(teamID, details)
  },
  [TeamsGen.setTeamVersion]: (draftState, action) => {
    const {teamID, version} = action.payload
    draftState.teamVersion.set(
      teamID,
      Constants.ratchetTeamVersion(version, draftState.teamVersion.get(teamID))
    )
  },
  [TeamsGen.setEmailInviteError]: (draftState, action) => {
    if (!action.payload.malformed.length && !action.payload.message) {
      draftState.errorInEmailInvite = Constants.emptyEmailInviteError
      return
    }
    draftState.errorInEmailInvite.malformed = new Set(action.payload.malformed)
    draftState.errorInEmailInvite.message = action.payload.message
  },
  [TeamsGen.getTeams]: (draftState, action) => {
    if (action.payload._subscribe) {
      draftState.teamMetaSubscribeCount++
    }
  },
  [TeamsGen.loadTeam]: (draftState, action) => {
    if (action.payload._subscribe) {
      const {teamID} = action.payload
      draftState.teamDetailsSubscriptionCount.set(
        teamID,
        (draftState.teamDetailsSubscriptionCount.get(teamID) ?? 0) + 1
      )
    }
  },
  [TeamsGen.unsubscribeTeamDetails]: (draftState, action) => {
    const {teamID} = action.payload
    draftState.teamDetailsSubscriptionCount.set(
      teamID,
      (draftState.teamDetailsSubscriptionCount.get(teamID) ?? 1) - 1
    )
  },
  [TeamsGen.unsubscribeTeamList]: draftState => {
    if (draftState.teamMetaSubscribeCount > 0) {
      draftState.teamMetaSubscribeCount--
    }
  },
  [TeamsGen.setTeamInfo]: (draftState, action) => {
    draftState.teamNameToID = action.payload.teamNameToID
    draftState.teamnames = action.payload.teamnames
    draftState.teamMeta = Constants.mergeTeamMeta(draftState.teamMeta, action.payload.teamMeta)
    draftState.teamMetaStale = false
  },
  [EngineGen.keybase1NotifyTeamTeamMetadataUpdate]: draftState => {
    draftState.teamMetaStale = true
  },
  [TeamsGen.setTeamAccessRequestsPending]: (draftState, action) => {
    draftState.teamAccessRequestsPending = action.payload.accessRequestsPending
  },
  [TeamsGen.setNewTeamInfo]: (draftState, action) => {
    draftState.deletedTeams = action.payload.deletedTeams
    draftState.newTeams = action.payload.newTeams
    draftState.teamIDToResetUsers = action.payload.teamIDToResetUsers
  },
  [TeamsGen.setTeamProfileAddList]: (draftState, action) => {
    draftState.teamProfileAddList = action.payload.teamlist
  },
  [TeamsGen.setTeamSawChatBanner]: draftState => {
    draftState.sawChatBanner = true
  },
  [TeamsGen.setTeamSawSubteamsBanner]: draftState => {
    draftState.sawSubteamsBanner = true
  },
  [TeamsGen.setTeamsWithChosenChannels]: (draftState, action) => {
    draftState.teamsWithChosenChannels = action.payload.teamsWithChosenChannels
  },
  [TeamsGen.setEditDescriptionError]: (draftState, action) => {
    draftState.errorInEditDescription = action.payload.error
  },
  [TeamsGen.setEditMemberError]: (draftState, action) => {
    draftState.errorInEditMember.error = action.payload.error
    draftState.errorInEditMember.username = action.payload.username
    draftState.errorInEditMember.teamID = action.payload.teamID
  },
  [TeamsGen.editTeamDescription]: draftState => {
    draftState.errorInEditDescription = ''
  },
  [TeamsGen.setChannelSelected]: (draftState, action) => {
    const {teamID, channel, selected, clearAll} = action.payload
    if (clearAll) {
      draftState.teamSelectedChannels.delete(teamID)
    } else {
      const channelsSelected = mapGetEnsureValue(draftState.teamSelectedChannels, teamID, new Set())
      if (selected) {
        channelsSelected.add(channel)
      } else {
        channelsSelected.delete(channel)
      }
    }
  },
  [TeamsGen.teamSetMemberSelected]: (draftState, action) => {
    const {teamID, username, selected, clearAll} = action.payload
    if (clearAll) {
      draftState.teamSelectedMembers.delete(teamID)
    } else {
      const membersSelected = mapGetEnsureValue(draftState.teamSelectedMembers, teamID, new Set())
      if (selected) {
        membersSelected.add(username)
      } else {
        membersSelected.delete(username)
      }
    }
  },
  [TeamsGen.channelSetMemberSelected]: (draftState, action) => {
    const {conversationIDKey, username, selected, clearAll} = action.payload
    if (clearAll) {
      draftState.channelSelectedMembers.delete(conversationIDKey)
    } else {
      const membersSelected = mapGetEnsureValue(
        draftState.channelSelectedMembers,
        conversationIDKey,
        new Set()
      )
      if (selected) {
        membersSelected.add(username)
      } else {
        membersSelected.delete(username)
      }
    }
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
  [TeamsGen.toggleInvitesCollapsed]: (draftState, action) => {
    const {teamID} = action.payload
    const {invitesCollapsed} = draftState
    if (invitesCollapsed.has(teamID)) {
      invitesCollapsed.delete(teamID)
    } else {
      invitesCollapsed.add(teamID)
    }
  },
  [TeamsGen.setSubteamFilter]: (draftState, action) => {
    const {filter, parentTeam} = action.payload
    draftState.subteamFilter = filter
    if (parentTeam && filter) {
      const flc = filter.toLowerCase()
      draftState.subteamsFiltered = new Set(
        [...(draftState.teamDetails.get(parentTeam)?.subteams || [])].filter(sID =>
          draftState.teamMeta
            .get(sID)
            ?.teamname.toLowerCase()
            .includes(flc)
        )
      )
    } else {
      draftState.subteamsFiltered = undefined
    }
  },
  [TeamsGen.loadedWelcomeMessage]: (draftState, action) => {
    const {teamID, message} = action.payload
    draftState.teamIDToWelcomeMessage.set(teamID, message)
  },
  [TeamsGen.setWelcomeMessageError]: (draftState, action) => {
    draftState.errorInEditWelcomeMessage = action.payload.error
  },
  [TeamsGen.setWelcomeMessage]: (draftState, _) => {
    draftState.errorInEditWelcomeMessage = ''
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
    draftState.newTeamWizard.showcase = action.payload.showcase
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
  [TeamsGen.addMembersWizardSetMembers]: (draftState, action) => {
    draftState.addMembersWizard.addingMembers = action.payload.members
    draftState.addMembersWizard.membersAlreadyInTeam = action.payload.membersAlreadyInTeam

    if (
      ['admin', 'owner'].includes(draftState.addMembersWizard.role) &&
      action.payload.members.some(m => m.assertion.includes('@'))
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
  [TeamsGen.setNewTeamRequests]: (draftState, action) => {
    draftState.newTeamRequests = action.payload.newTeamRequests
  },
  [TeamsGen.setActivityLevels]: (draftState, action) => {
    draftState.activityLevels = action.payload.levels
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
  [TeamsGen.teamChannelListLoaded]: (draftState, action) => {
    const {channels, teamID} = action.payload
    draftState.channelInfo.set(teamID, channels)
  },
  [EngineGen.chat1NotifyChatChatWelcomeMessageLoaded]: (draftState, action) => {
    const {teamID, message} = action.payload.params
    draftState.teamIDToWelcomeMessage.set(teamID, message)
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

    var memberships = usernameMemberships.get(targetUsername)
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

    var memberships = usernameMemberships.get(targetUsername)
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
