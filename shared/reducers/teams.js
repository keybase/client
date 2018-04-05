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
      return state.set('channelCreationError', action.payload.error)

    case TeamsGen.setTeamCreationError:
      return state.set('teamCreationError', action.payload.error)

    case TeamsGen.setTeamCreationPending:
      return state.set('teamCreationPending', action.payload.pending)

    case TeamsGen.setTeamJoinError:
      return state.set('teamJoinError', action.payload.error)

    case TeamsGen.setTeamJoinSuccess:
      return state.withMutations(s => {
        s.set('teamJoinSuccess', action.payload.success)
        s.set('teamJoinSuccessTeamName', action.payload.teamname)
      })

    case TeamsGen.setTeamStoreRetentionPolicy:
      return state.setIn(
        ['teamNameToRetentionPolicy', action.payload.teamname],
        action.payload.retentionPolicy
      )

    case TeamsGen.setTeamLoadingInvites:
      return state.setIn(
        ['teamNameToLoadingInvites', action.payload.teamname, action.payload.invitees],
        action.payload.loadingInvites
      )

    case TeamsGen.setTeamRequests:
      return state.set('teamNameToRequests', action.payload.requests)

    case TeamsGen.setTeamDetails:
      return state.withMutations(s => {
        s.setIn(['teamNameToMembers', action.payload.teamname], action.payload.members)
        s.setIn(['teamNameToMemberUsernames', action.payload.teamname], action.payload.usernames)
        s.setIn(['teamNameToTeamSettings', action.payload.teamname], action.payload.settings)
        s.setIn(['teamNameToInvites', action.payload.teamname], action.payload.invites)
        s.setIn(['teamNameToSubteams', action.payload.teamname], action.payload.subteams)
      })

    case TeamsGen.setTeamCanPerform:
      return state.setIn(['teamNameToCanPerform', action.payload.teamname], action.payload.teamOperation)

    case TeamsGen.setTeamPublicitySettings:
      return state.setIn(['teamNameToPublicitySettings', action.payload.teamname], action.payload.publicity)

    case TeamsGen.setTeamChannels:
      return state.withMutations(s => {
        s.setIn(['teamNameToConvIDs', action.payload.teamname], I.Set(action.payload.convIDs))
        s.mergeIn(['convIDToChannelInfo'], I.Map(action.payload.channelInfos))
      })

    case TeamsGen.setLoaded:
      return state.set('loaded', action.payload.loaded)

    case TeamsGen.setTeamInfo:
      return state.withMutations(s => {
        s.set('teamnames', action.payload.teamnames)
        s.set('teammembercounts', action.payload.teammembercounts)
        s.set('teamNameToIsOpen', action.payload.teamNameToIsOpen)
        s.set('teamNameToRole', action.payload.teamNameToRole)
        s.set('teamNameToAllowPromote', action.payload.teamNameToAllowPromote)
        s.set('teamNameToIsShowcasing', action.payload.teamNameToIsShowcasing)
        s.set('teamNameToID', action.payload.teamNameToID)
      })

    case TeamsGen.setTeamAccessRequestsPending:
      return state.set('teamAccessRequestsPending', action.payload.accessRequestsPending)

    case TeamsGen.setNewTeamInfo:
      return state.withMutations(s => {
        s.set('newTeams', action.payload.newTeams)
        s.set('newTeamRequests', action.payload.newTeamRequests)
        s.set('teamNameToResetUsers', I.Map(action.payload.teamNameToResetUsers))
      })

    case TeamsGen.setTeamSawChatBanner:
      return state.set('sawChatBanner', true)

    case TeamsGen.setTeamSawSubteamsBanner:
      return state.set('sawSubteamsBanner', true)

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
