// @flow
import * as TeamsGen from '../actions/teams-gen'
import * as Constants from '../constants/teams'
import * as I from 'immutable'
import * as Types from '../constants/types/teams'

const initialState: Types.State = Constants.makeState()

const rootReducer = (state: Types.State = initialState, action: TeamsGen.Actions): Types.State => {
  switch (action.type) {
    case TeamsGen.resetStore:
      return initialState
    case TeamsGen.setChannelCreationError:
      return state.merge({channelCreationError: action.payload.error})
    case TeamsGen.setTeamCreationError:
      return state.merge({teamCreationError: action.payload.error})
    case TeamsGen.setAddUserToTeamsResults:
      return state.merge({addUserToTeamsResults: action.payload.results})
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
    case TeamsGen.setTeamCanPerform:
      return state.setIn(['teamNameToCanPerform', action.payload.teamname], action.payload.teamOperation)
    case TeamsGen.setTeamPublicitySettings:
      return state.setIn(['teamNameToPublicitySettings', action.payload.teamname], action.payload.publicity)
    case TeamsGen.setTeamChannelInfo:
      const {conversationIDKey, channelInfo} = action.payload
      return state.updateIn(['teamNameToChannelInfos', action.payload.teamname], channelInfos =>
        channelInfos
          ? channelInfos.set(conversationIDKey, channelInfo)
          : I.Map([[conversationIDKey, channelInfo]])
      )
    case TeamsGen.setTeamChannels:
      return state.setIn(['teamNameToChannelInfos', action.payload.teamname], action.payload.channelInfos)
    case TeamsGen.setEmailInviteError:
      return state.merge({
        emailInviteError: Constants.makeEmailInviteError({
          malformed: I.Set(action.payload.malformed),
          message: action.payload.message,
        }),
      })
    case TeamsGen.setLoaded:
      return state.merge({loaded: action.payload.loaded})
    case TeamsGen.setTeamInfo:
      return state.merge({
        teamnames: action.payload.teamnames,
        teammembercounts: action.payload.teammembercounts,
        teamNameToIsOpen: action.payload.teamNameToIsOpen,
        teamNameToRole: action.payload.teamNameToRole,
        teamNameToAllowPromote: action.payload.teamNameToAllowPromote,
        teamNameToIsShowcasing: action.payload.teamNameToIsShowcasing,
        teamNameToID: action.payload.teamNameToID,
      })
    case TeamsGen.setTeamAccessRequestsPending:
      return state.merge({teamAccessRequestsPending: action.payload.accessRequestsPending})
    case TeamsGen.setNewTeamInfo:
      return state.merge({
        newTeams: action.payload.newTeams,
        newTeamRequests: action.payload.newTeamRequests,
        teamNameToResetUsers: action.payload.teamNameToResetUsers,
      })
    case TeamsGen.setTeamProfileAddList:
      return state.merge({teamProfileAddList: action.payload.teamlist})
    case TeamsGen.setTeamSawChatBanner:
      return state.merge({sawChatBanner: true})
    case TeamsGen.setTeamSawSubteamsBanner:
      return state.merge({sawSubteamsBanner: true})
    case TeamsGen.setTeamsWithChosenChannels:
      const teams = action.payload.teamsWithChosenChannels
      return state.merge({teamsWithChosenChannels: teams})
    case TeamsGen.setUpdatedChannelName:
      return state.mergeIn(
        ['teamNameToChannelInfos', action.payload.teamname, action.payload.conversationIDKey],
        {channelname: action.payload.newChannelName}
      )
    case TeamsGen.setUpdatedTopic:
      return state.mergeIn(
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
        ['teamNameToChannelInfos', action.payload.teamname, action.payload.conversationIDKey, 'participants'],
        set => set.add(action.payload.participant)
      )
    case TeamsGen.removeParticipant:
      return state.deleteIn([
        'teamNameToChannelInfos',
        action.payload.teamname,
        action.payload.conversationIDKey,
        'participants',
        action.payload.participant,
      ])
    // Saga-only actions
    case TeamsGen.addPeopleToTeam:
    case TeamsGen.addUserToTeams:
    case TeamsGen.addToTeam:
    case TeamsGen.badgeAppForTeams:
    case TeamsGen.checkRequestedAccess:
    case TeamsGen.createChannel:
    case TeamsGen.createNewTeam:
    case TeamsGen.createNewTeamFromConversation:
    case TeamsGen.deleteChannelConfirmed:
    case TeamsGen.editMembership:
    case TeamsGen.editTeamDescription:
    case TeamsGen.uploadTeamAvatar:
    case TeamsGen.getChannelInfo:
    case TeamsGen.getChannels:
    case TeamsGen.getDetails:
    case TeamsGen.getDetailsForAllTeams:
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
    case TeamsGen.saveChannelMembership:
    case TeamsGen.setMemberPublicity:
    case TeamsGen.setPublicity:
    case TeamsGen.saveTeamRetentionPolicy:
    case TeamsGen.updateChannelName:
    case TeamsGen.updateTopic:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}

export default rootReducer
