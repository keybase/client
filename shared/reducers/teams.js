// @flow
import * as TeamsGen from '../actions/teams-gen'
import * as Constants from '../constants/teams'
import * as Types from '../constants/types/teams'

const initialState: Types.State = Constants.makeState()

const rootReducer = (state: Types.State = initialState, action: TeamsGen.Actions): Types.State => {
  switch (action.type) {
    case TeamsGen.resetStore:
      return initialState

    case TeamsGen.setChannelCreationError:
      return state.set('channelCreationError', action.payload.error)

    case TeamsGen.setTeamCreationError:
    case TeamsGen.setTeamCreationPending:
    case TeamsGen.setTeamJoinError:
    case TeamsGen.setTeamJoinSuccess:
    case TeamsGen.setTeamStoreRetentionPolicy:
    case TeamsGen.setTeamLoadingInvites:
    case TeamsGen.setTeamRequests:
    case TeamsGen.setTeamMembers:
    case TeamsGen.setTeamMemberUsernames:
    case TeamsGen.setTeamSettings:
    case TeamsGen.setTeamInvites:
    case TeamsGen.setTeamSubteams:
    case TeamsGen.setTeamCanPerform:
    case TeamsGen.setTeamPublicitySettings:
    case TeamsGen.setTeamConvIDs:
    case TeamsGen.setChannelInfo:
    case TeamsGen.setLoaded:
    case TeamsGen.setTeamInfo:
    case TeamsGen.setTeamAccessRequestsPending:
    case TeamsGen.setNewTeams:
    case TeamsGen.setNewTeamRequests:
    case TeamsGen.setTeamResetUsers:
    case TeamsGen.setTeamSawChatBanner:
    case TeamsGen.setTeamSawSubteamsBanner:
      throw new Error('implement')

    // Saga-only actions
    case TeamsGen.addPeopleToTeam:
    case TeamsGen.addToTeam:
    case TeamsGen.badgeAppForTeams:
    case TeamsGen.checkRequestedAccess:
    case TeamsGen.createChannel:
    case TeamsGen.createNewTeam:
    case TeamsGen.createNewTeamFromConversation:
    case TeamsGen.deleteChannelConfirmed:
    case TeamsGen.editMembership:
    case TeamsGen.editTeamDescription:
    case TeamsGen.getChannels:
    case TeamsGen.getDetails:
    case TeamsGen.getTeamOperations:
    case TeamsGen.getTeamPublicity:
    case TeamsGen.getTeamRetentionPolicy:
    case TeamsGen.getTeams:
    case TeamsGen.ignoreRequest:
    case TeamsGen.inviteToTeamByEmail:
    case TeamsGen.inviteToTeamByPhone:
    case TeamsGen.joinTeam:
    case TeamsGen.leaveTeam:
    case TeamsGen.removeMemberOrPendingInvite:
    case TeamsGen.saveChannelMembership:
    case TeamsGen.setMemberPublicity:
    case TeamsGen.setPublicity:
    case TeamsGen.setTeamRetentionPolicy:
    case TeamsGen.setupTeamHandlers:
    case TeamsGen.updateChannelName:
    case TeamsGen.updateTopic:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default rootReducer
