import * as TeamsGen from '../actions/teams-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/teams'
import * as Types from '../constants/types/teams'
import * as Container from '../util/container'
import {editTeambuildingDraft} from './team-building'
import {mapGetEnsureValue} from '../util/map'

const initialState: Types.State = Constants.makeState()

const handleTeamBuilding = (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
  const val = editTeambuildingDraft('teams', draftState.teamBuilding, action)
  if (val !== undefined) {
    draftState.teamBuilding = val
  }
}

export default Container.makeReducer<
  | TeamsGen.Actions
  | TeamBuildingGen.Actions
  | EngineGen.Keybase1NotifyTeamTeamMetadataUpdatePayload
  | EngineGen.Chat1NotifyChatChatWelcomeMessageLoadedPayload,
  Types.State
>(initialState, {
  [TeamsGen.resetStore]: () => {
    return initialState
  },
  [TeamsGen.setChannelCreationError]: (draftState, action) => {
    draftState.errorInChannelCreation = action.payload.error
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
    const {teamID, details} = action.payload
    draftState.teamDetails.set(teamID, details)
    draftState.teamMemberToSubteams.set(teamID, details.members)
  },
  [TeamsGen.setTeamVersion]: (draftState, action) => {
    const {teamID, version} = action.payload
    draftState.teamVersion.set(
      teamID,
      Constants.ratchetTeamVersion(version, draftState.teamVersion.get(teamID))
    )
  },
  [TeamsGen.setTeamCanPerform]: (draftState, action) => {
    draftState.canPerform.set(action.payload.teamID, action.payload.teamOperation)
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
  [TeamsGen.setMemberSubteamDetails]: (draftState, action) => {
    action.payload.memberships.forEach((info, teamID) => {
      if (!draftState.teamMemberToSubteams.has(teamID)) {
        draftState.teamMemberToSubteams.set(teamID, new Map())
      }
      draftState.teamMemberToSubteams.get(teamID)?.set(info.username, info)
    })
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
  [TeamsGen.startAddMembersWizard]: (draftState, action) => {
    const {teamID} = action.payload
    draftState.addMembersWizard = {...Constants.addMembersWizardEmptyState, teamID}
  },
  [TeamsGen.setAddMembersWizardRole]: (draftState, action) => {
    const {role} = action.payload
    draftState.addMembersWizard.role = role
    if (role) {
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
  [TeamsGen.addMembersWizardPushMembers]: (draftState, action) => {
    draftState.addMembersWizard.addingMembers = Constants.dedupAddingMembeers(
      draftState.addMembersWizard.addingMembers,
      action.payload.members
    )
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
  [TeamsGen.finishAddMembersWizard]: draftState => {
    draftState.addMembersWizard = {...Constants.addMembersWizardEmptyState, justFinished: true}
  },
  [TeamsGen.addMembersWizardSetDefaultChannels]: (draftState, action) => {
    const {toAdd, toRemove} = action.payload
    if (!draftState.addMembersWizard.defaultChannels) {
      // we're definitely setting these manually now
      draftState.addMembersWizard.defaultChannels = []
    }
    const defaultChannels = draftState.addMembersWizard.defaultChannels
    toAdd?.forEach(channel => {
      if (!defaultChannels.find(dc => dc.conversationIDKey === channel.conversationIDKey)) {
        defaultChannels?.push(channel)
      }
    })
    const maybeRemoveIdx =
      (toRemove && defaultChannels.findIndex(dc => dc.conversationIDKey === toRemove.conversationIDKey)) ?? -1
    if (maybeRemoveIdx >= 0) {
      defaultChannels.splice(maybeRemoveIdx, 1)
    }
  },
  [TeamsGen.setNewTeamRequests]: (draftState, action) => {
    draftState.newTeamRequests = action.payload.newTeamRequests
  },
  [TeamsGen.setActivityLevels]: (draftState, action) => {
    draftState.activityLevels = action.payload.levels
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
})
