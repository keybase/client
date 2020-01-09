import * as TeamsGen from '../actions/teams-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/teams'
import * as Types from '../constants/types/teams'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
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
  TeamsGen.Actions | TeamBuildingGen.Actions | EngineGen.Keybase1NotifyTeamTeamMetadataUpdatePayload,
  Types.State
>(initialState, {
  [TeamsGen.resetStore]: () => {
    return initialState
  },
  [TeamsGen.setChannelCreationError]: (draftState, action) => {
    draftState.channelCreationError = action.payload.error
  },
  [TeamsGen.createNewTeam]: draftState => {
    draftState.teamCreationError = ''
  },
  [TeamsGen.createNewTeamFromConversation]: draftState => {
    draftState.teamCreationError = ''
  },
  [TeamsGen.teamCreated]: (draftState, action) => {
    draftState.teamNameToID.set(action.payload.teamname, action.payload.teamID)
  },
  [TeamsGen.setTeamCreationError]: (draftState, action) => {
    draftState.teamCreationError = action.payload.error
  },
  [TeamsGen.clearAddUserToTeamsResults]: draftState => {
    draftState.addUserToTeamsResults = ''
    draftState.addUserToTeamsState = 'notStarted'
  },
  [TeamsGen.setAddUserToTeamsResults]: (draftState, action) => {
    draftState.addUserToTeamsResults = action.payload.results
    draftState.addUserToTeamsState = action.payload.error ? 'failed' : 'succeeded'
  },
  [TeamsGen.setTeamInviteError]: (draftState, action) => {
    draftState.teamInviteError = action.payload.error
  },
  [TeamsGen.setTeamJoinError]: (draftState, action) => {
    draftState.teamJoinError = action.payload.error
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
  [TeamsGen.setTeamDetails]: (draftState, action) => {
    const {teamname, teamID} = action.payload
    const members = Constants.rpcDetailsToMemberInfos(action.payload.members)
    const details = mapGetEnsureValue(
      draftState.teamDetails,
      teamID,
      Constants.makeTeamDetails({id: teamID, teamname})
    )
    details.members = members
    details.settings = action.payload.settings
    details.invites = new Set(action.payload.invites)
    details.subteams = action.payload.subteamIDs
    details.requests = new Set(action.payload.requests.get(teamname))
  },
  [TeamsGen.setTeamCanPerform]: (draftState, action) => {
    draftState.canPerform.set(action.payload.teamID, action.payload.teamOperation)
  },
  [TeamsGen.setTeamPublicitySettings]: (draftState, action) => {
    draftState.teamIDToPublicitySettings.set(action.payload.teamID, action.payload.publicity)
  },
  [TeamsGen.setTeamChannelInfo]: (draftState, action) => {
    const {conversationIDKey, channelInfo, teamID} = action.payload
    draftState.teamIDToChannelInfos.set(
      teamID,
      mapGetEnsureValue(draftState.teamIDToChannelInfos, teamID, new Map()).set(
        conversationIDKey,
        channelInfo
      )
    )
  },
  [TeamsGen.setTeamChannels]: (draftState, action) => {
    draftState.teamIDToChannelInfos.set(action.payload.teamID, action.payload.channelInfos)
  },
  [TeamsGen.setEmailInviteError]: (draftState, action) => {
    if (!action.payload.malformed.length && !action.payload.message) {
      draftState.emailInviteError = Constants.emptyEmailInviteError
      return
    }
    draftState.emailInviteError.malformed = new Set(action.payload.malformed)
    draftState.emailInviteError.message = action.payload.message
  },
  [TeamsGen.getTeams]: (draftState, action) => {
    if (action.payload._subscribe) {
      draftState.teamDetailsMetaSubscribeCount++
    }
  },
  [TeamsGen.unsubscribeTeamList]: draftState => {
    if (draftState.teamDetailsMetaSubscribeCount > 0) {
      draftState.teamDetailsMetaSubscribeCount--
    }
  },
  [TeamsGen.setTeamInfo]: (draftState, action) => {
    draftState.teamNameToID = action.payload.teamNameToID
    draftState.teamnames = action.payload.teamnames
    draftState.teamDetails = Constants.mergeTeamDetails(draftState.teamDetails, action.payload.teamDetails)
    draftState.teamDetailsMetaStale = false
  },
  [EngineGen.keybase1NotifyTeamTeamMetadataUpdate]: draftState => {
    draftState.teamDetailsMetaStale = true
  },
  [TeamsGen.setTeamAccessRequestsPending]: (draftState, action) => {
    draftState.teamAccessRequestsPending = action.payload.accessRequestsPending
  },
  [TeamsGen.setNewTeamInfo]: (draftState, action) => {
    draftState.deletedTeams = action.payload.deletedTeams
    draftState.newTeams = action.payload.newTeams
    draftState.teamIDToResetUsers = action.payload.teamIDToResetUsers

    const newTeamRequests = new Map<Types.TeamID, number>()
    action.payload.newTeamRequests.forEach(teamID => {
      newTeamRequests.set(teamID, (newTeamRequests.get(teamID) || 0) + 1)
    })
    draftState.newTeamRequests = newTeamRequests
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
  [TeamsGen.setUpdatedChannelName]: (draftState, action) => {
    const {teamID, conversationIDKey, newChannelName} = action.payload
    const oldChannelInfos = mapGetEnsureValue(draftState.teamIDToChannelInfos, teamID, new Map())
    const oldChannelInfo = mapGetEnsureValue(oldChannelInfos, conversationIDKey, Constants.initialChannelInfo)
    oldChannelInfo.channelname = newChannelName
  },
  [TeamsGen.setUpdatedTopic]: (draftState, action) => {
    const {teamID, conversationIDKey, newTopic} = action.payload
    const oldChannelInfos = mapGetEnsureValue(draftState.teamIDToChannelInfos, teamID, new Map())
    const oldChannelInfo = mapGetEnsureValue(oldChannelInfos, conversationIDKey, Constants.initialChannelInfo)
    oldChannelInfo.description = newTopic
  },
  [TeamsGen.deleteChannelInfo]: (draftState, action) => {
    const {teamID, conversationIDKey} = action.payload
    const oldChannelInfos = draftState.teamIDToChannelInfos.get(teamID)
    if (oldChannelInfos) {
      oldChannelInfos.delete(conversationIDKey)
    }
  },
  [TeamsGen.addParticipant]: (draftState, action) => {
    const {teamID, conversationIDKey} = action.payload
    const oldChannelInfos = mapGetEnsureValue(draftState.teamIDToChannelInfos, teamID, new Map())
    const oldChannelInfo = mapGetEnsureValue(oldChannelInfos, conversationIDKey, Constants.initialChannelInfo)
    oldChannelInfo.memberStatus = RPCChatTypes.ConversationMemberStatus.active
  },
  [TeamsGen.removeParticipant]: (draftState, action) => {
    const {teamID, conversationIDKey} = action.payload
    const oldChannelInfos = mapGetEnsureValue(draftState.teamIDToChannelInfos, teamID, new Map())
    const oldChannelInfo = mapGetEnsureValue(oldChannelInfos, conversationIDKey, Constants.initialChannelInfo)
    oldChannelInfo.memberStatus = RPCChatTypes.ConversationMemberStatus.left
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
