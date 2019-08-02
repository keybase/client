import * as TeamsGen from '../actions/teams-gen'
import * as Constants from '../constants/teams'
import * as I from 'immutable'
import * as Types from '../constants/types/teams'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import teamBuildingReducer from './team-building'
import {ifTSCComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch} from '../util/switch'

const initialState: Types.State = Constants.makeState()

const rootReducer = (
  state: Types.State = initialState,
  action: TeamsGen.Actions | TeamBuildingGen.Actions
): Types.State => {
  switch (action.type) {
    case TeamsGen.resetStore:
      return initialState
    case TeamsGen.setChannelCreationError:
      return state.merge({channelCreationError: action.payload.error})
    case TeamsGen.setTeamCreationError:
      return state.merge({teamCreationError: action.payload.error})
    case TeamsGen.clearAddUserToTeamsResults:
      return state.merge({addUserToTeamsResults: '', addUserToTeamsState: 'notStarted'})
    case TeamsGen.setAddUserToTeamsResults:
      return state.merge({
        addUserToTeamsResults: action.payload.results,
        addUserToTeamsState: action.payload.error ? 'failed' : 'succeeded',
      })
    case TeamsGen.setTeamInviteError:
      return state.merge({teamInviteError: action.payload.error})
    case TeamsGen.setTeamJoinError:
      return state.merge({teamJoinError: action.payload.error})
    case TeamsGen.setTeamJoinSuccess:
      return state.merge({
        teamJoinSuccess: action.payload.success,
        teamJoinSuccessTeamName: action.payload.teamname,
      })
    case TeamsGen.setTeamRetentionPolicy:
      return state.setIn(
        ['teamNameToRetentionPolicy', action.payload.teamname],
        action.payload.retentionPolicy
      )
    case TeamsGen.setTeamLoadingInvites:
      return state.setIn(
        ['teamNameToLoadingInvites', action.payload.teamname, action.payload.invitees],
        action.payload.loadingInvites
      )
    case TeamsGen.clearTeamRequests:
      return state.setIn(['teamNameToRequests', action.payload.teamname], I.Set())
    case TeamsGen.setTeamDetails:
      return state.withMutations(s => {
        s.setIn(['teamNameToMembers', action.payload.teamname], action.payload.members)
        s.setIn(['teamNameToSettings', action.payload.teamname], action.payload.settings)
        s.setIn(['teamNameToInvites', action.payload.teamname], action.payload.invites)
        s.setIn(['teamNameToSubteams', action.payload.teamname], action.payload.subteams)
        s.mergeIn(['teamNameToRequests'], action.payload.requests)
      })
    case TeamsGen.setMembers:
      return state.setIn(['teamNameToMembers', action.payload.teamname], action.payload.members)
    case TeamsGen.setTeamCanPerform:
      return state.setIn(['teamNameToCanPerform', action.payload.teamname], action.payload.teamOperation)
    case TeamsGen.setTeamPublicitySettings:
      return state.setIn(['teamNameToPublicitySettings', action.payload.teamname], action.payload.publicity)
    case TeamsGen.setTeamChannelInfo: {
      const {conversationIDKey, channelInfo} = action.payload
      return state.updateIn(['teamNameToChannelInfos', action.payload.teamname], channelInfos =>
        channelInfos
          ? channelInfos.set(conversationIDKey, channelInfo)
          : I.Map([[conversationIDKey, channelInfo]])
      )
    }
    case TeamsGen.setTeamChannels:
      return state.setIn(['teamNameToChannelInfos', action.payload.teamname], action.payload.channelInfos)
    case TeamsGen.setEmailInviteError:
      return state.merge({
        emailInviteError: Constants.makeEmailInviteError({
          malformed: I.Set(action.payload.malformed),
          message: action.payload.message,
        }),
      })
    case TeamsGen.setTeamInfo:
      return state.merge({
        teamNameToAllowPromote: action.payload.teamNameToAllowPromote,
        teamNameToID: action.payload.teamNameToID,
        teamNameToIsOpen: action.payload.teamNameToIsOpen,
        teamNameToIsShowcasing: action.payload.teamNameToIsShowcasing,
        teamNameToRole: action.payload.teamNameToRole,
        teammembercounts: action.payload.teammembercounts,
        teamnames: action.payload.teamnames,
      })
    case TeamsGen.setTeamAccessRequestsPending:
      return state.merge({teamAccessRequestsPending: action.payload.accessRequestsPending})
    case TeamsGen.setNewTeamInfo:
      return state.merge({
        deletedTeams: action.payload.deletedTeams,
        newTeamRequests: action.payload.newTeamRequests,
        newTeams: action.payload.newTeams,
        teamNameToResetUsers: action.payload.teamNameToResetUsers,
      })
    case TeamsGen.setTeamProfileAddList:
      return state.merge({teamProfileAddList: action.payload.teamlist})
    case TeamsGen.setTeamSawChatBanner:
      return state.merge({sawChatBanner: true})
    case TeamsGen.setTeamSawSubteamsBanner:
      return state.merge({sawSubteamsBanner: true})
    case TeamsGen.setTeamsWithChosenChannels: {
      const teams = action.payload.teamsWithChosenChannels
      return state.merge({teamsWithChosenChannels: teams})
    }
    case TeamsGen.setUpdatedChannelName:
      return state.mergeIn(
        // @ts-ignore
        ['teamNameToChannelInfos', action.payload.teamname, action.payload.conversationIDKey],
        {channelname: action.payload.newChannelName}
      )
    case TeamsGen.setUpdatedTopic:
      return state.mergeIn(
        // @ts-ignore
        ['teamNameToChannelInfos', action.payload.teamname, action.payload.conversationIDKey],
        {description: action.payload.newTopic}
      )
    case TeamsGen.deleteChannelInfo:
      return state.deleteIn([
        'teamNameToChannelInfos',
        action.payload.teamname,
        action.payload.conversationIDKey,
      ])
    case TeamsGen.addParticipant:
      return state.updateIn(
        ['teamNameToChannelInfos', action.payload.teamname, action.payload.conversationIDKey, 'memberStatus'],
        () => RPCChatTypes.ConversationMemberStatus.active
      )
    case TeamsGen.removeParticipant:
      return state.updateIn(
        ['teamNameToChannelInfos', action.payload.teamname, action.payload.conversationIDKey, 'memberStatus'],
        () => RPCChatTypes.ConversationMemberStatus.left
      )
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
    case TeamBuildingGen.addUsersToTeamSoFar:
    case TeamBuildingGen.removeUsersFromTeamSoFar:
    case TeamBuildingGen.searchResultsLoaded:
    case TeamBuildingGen.finishedTeamBuilding:
    case TeamBuildingGen.fetchedUserRecs:
    case TeamBuildingGen.fetchUserRecs:
    case TeamBuildingGen.search:
    case TeamBuildingGen.selectRole:
    case TeamBuildingGen.changeSendNotification:
      return state.update('teamBuilding', teamBuilding => teamBuildingReducer('teams', teamBuilding, action))
    // Saga-only actions
    case TeamsGen.addUserToTeams:
    case TeamsGen.addToTeam:
    case TeamsGen.reAddToTeam:
    case TeamsGen.badgeAppForTeams:
    case TeamsGen.checkRequestedAccess:
    case TeamsGen.clearNavBadges:
    case TeamsGen.createChannel:
    case TeamsGen.createNewTeam:
    case TeamsGen.createNewTeamFromConversation:
    case TeamsGen.deleteChannelConfirmed:
    case TeamsGen.deleteTeam:
    case TeamsGen.editMembership:
    case TeamsGen.editTeamDescription:
    case TeamsGen.uploadTeamAvatar:
    case TeamsGen.getChannelInfo:
    case TeamsGen.getChannels:
    case TeamsGen.getDetails:
    case TeamsGen.getDetailsForAllTeams:
    case TeamsGen.getMembers:
    case TeamsGen.getTeamOperations:
    case TeamsGen.getTeamProfileAddList:
    case TeamsGen.getTeamPublicity:
    case TeamsGen.getTeamRetentionPolicy:
    case TeamsGen.getTeams:
    case TeamsGen.addTeamWithChosenChannels:
    case TeamsGen.ignoreRequest:
    case TeamsGen.inviteToTeamByEmail:
    case TeamsGen.inviteToTeamByPhone:
    case TeamsGen.joinTeam:
    case TeamsGen.leaveTeam:
    case TeamsGen.leftTeam:
    case TeamsGen.removeMemberOrPendingInvite:
    case TeamsGen.renameTeam:
    case TeamsGen.saveChannelMembership:
    case TeamsGen.setMemberPublicity:
    case TeamsGen.setPublicity:
    case TeamsGen.saveTeamRetentionPolicy:
    case TeamsGen.updateChannelName:
    case TeamsGen.updateTopic:
      return state
    default:
      ifTSCComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}

export default rootReducer
