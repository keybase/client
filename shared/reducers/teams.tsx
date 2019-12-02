import * as TeamsGen from '../actions/teams-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/teams'
import * as I from 'immutable'
import * as Types from '../constants/types/teams'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Container from '../util/container'
import {editTeambuildingDraft} from './team-building'
import {ifTSCComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch} from '../util/switch'

const initialState: Types.State = Constants.makeState()

export default (
  state: Types.State = initialState,
  action: TeamsGen.Actions | TeamBuildingGen.Actions | EngineGen.Keybase1NotifyTeamTeamMetadataUpdatePayload
): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case TeamsGen.resetStore:
        return initialState
      case TeamsGen.setChannelCreationError:
        draftState.channelCreationError = action.payload.error
        return
      case TeamsGen.createNewTeam:
      case TeamsGen.createNewTeamFromConversation:
        draftState.teamCreationError = ''
        return
      case TeamsGen.setTeamCreationError:
        draftState.teamCreationError = action.payload.error
        return
      case TeamsGen.clearAddUserToTeamsResults:
        draftState.addUserToTeamsResults = ''
        draftState.addUserToTeamsState = 'notStarted'
        return
      case TeamsGen.setAddUserToTeamsResults:
        draftState.addUserToTeamsResults = action.payload.results
        draftState.addUserToTeamsState = action.payload.error ? 'failed' : 'succeeded'
        return
      case TeamsGen.setTeamInviteError:
        draftState.teamInviteError = action.payload.error
        return
      case TeamsGen.setTeamJoinError:
        draftState.teamJoinError = action.payload.error
        return
      case TeamsGen.setTeamJoinSuccess:
        draftState.teamJoinSuccess = action.payload.success
        draftState.teamJoinSuccessTeamName = action.payload.teamname
        return
      case TeamsGen.setTeamRetentionPolicy:
        draftState.teamNameToRetentionPolicy = draftState.teamNameToRetentionPolicy.set(
          action.payload.teamname,
          action.payload.retentionPolicy
        )
        return
      case TeamsGen.setTeamLoadingInvites:
        draftState.teamNameToLoadingInvites = draftState.teamNameToLoadingInvites.update(
          action.payload.teamname,
          (inviteToLoading = I.Map<string, boolean>()) =>
            inviteToLoading.set(action.payload.loadingKey, action.payload.isLoading)
        )
        return
      case TeamsGen.setTeamDetails: {
        const members = Constants.rpcDetailsToMemberInfos(action.payload.members)
        draftState.teamNameToMembers = draftState.teamNameToMembers.set(
          action.payload.teamname,
          Constants.rpcDetailsToMemberInfos(action.payload.members)
        )
        draftState.teamNameToSettings = draftState.teamNameToSettings.set(
          action.payload.teamname,
          Constants.makeTeamSettings(action.payload.settings)
        )
        draftState.teamNameToSubteams = draftState.teamNameToSubteams.set(
          action.payload.teamname,
          I.Set(action.payload.subteams)
        )

        const details =
          draftState.teamDetails.get(action.payload.teamID) ||
          Constants.makeTeamDetails({teamname: action.payload.teamname})
        details.members = new Map(
          [...members.entries()].map(([username, memberInfo]) => [username, memberInfo.toObject()])
        )
        details.settings = action.payload.settings
        details.invites = new Set(action.payload.invites)
        details.subteams = new Set(action.payload.subteamIDs)
        details.requests = new Set(action.payload.requests.get(action.payload.teamname))
        draftState.teamDetails = new Map(
          draftState.teamDetails.set(action.payload.teamID, Constants.makeTeamDetails(details))
        )

        return
      }
      case TeamsGen.setMembers:
        draftState.teamNameToMembers = draftState.teamNameToMembers.set(
          action.payload.teamname,
          action.payload.members
        )
        return
      case TeamsGen.setTeamCanPerform: {
        draftState.teamNameToCanPerform = draftState.teamNameToCanPerform.set(
          action.payload.teamname,
          action.payload.teamOperation
        )
        const canPerform = new Map(draftState.canPerform)
        canPerform.set(action.payload.teamID, action.payload.teamOperation)
        draftState.canPerform = canPerform
        return
      }
      case TeamsGen.setTeamPublicitySettings:
        draftState.teamNameToPublicitySettings = draftState.teamNameToPublicitySettings.set(
          action.payload.teamname,
          action.payload.publicity
        )
        return
      case TeamsGen.setTeamChannelInfo: {
        const {conversationIDKey, channelInfo} = action.payload
        draftState.teamNameToChannelInfos = draftState.teamNameToChannelInfos.update(
          action.payload.teamname,
          channelInfos =>
            channelInfos
              ? channelInfos.set(conversationIDKey, channelInfo)
              : I.Map([[conversationIDKey, channelInfo]])
        )
        return
      }
      case TeamsGen.setTeamChannels:
        draftState.teamNameToChannelInfos = draftState.teamNameToChannelInfos.set(
          action.payload.teamname,
          action.payload.channelInfos
        )
        return
      case TeamsGen.setEmailInviteError:
        if (!action.payload.malformed.length && !action.payload.message) {
          draftState.emailInviteError = Constants.emptyEmailInviteError
          return
        }
        draftState.emailInviteError.malformed = new Set(action.payload.malformed)
        draftState.emailInviteError.message = action.payload.message
        return
      case TeamsGen.getTeams:
        if (action.payload._subscribe) {
          draftState.teamDetailsMetaSubscribeCount++
        }
        return
      case TeamsGen.unsubscribeTeamList:
        if (draftState.teamDetailsMetaSubscribeCount > 0) {
          draftState.teamDetailsMetaSubscribeCount--
        }
        return
      case TeamsGen.setTeamInfo:
        draftState.teamNameToAllowPromote = action.payload.teamNameToAllowPromote
        draftState.teamNameToID = action.payload.teamNameToID
        draftState.teamNameToIsOpen = action.payload.teamNameToIsOpen
        draftState.teamNameToIsShowcasing = action.payload.teamNameToIsShowcasing
        draftState.teamNameToRole = action.payload.teamNameToRole
        draftState.teammembercounts = action.payload.teammembercounts
        draftState.teamnames = action.payload.teamnames
        draftState.teamDetails = Constants.mergeTeamDetails(
          draftState.teamDetails,
          action.payload.teamDetails
        )
        draftState.teamDetailsMetaStale = false
        return
      case EngineGen.keybase1NotifyTeamTeamMetadataUpdate:
        draftState.teamDetailsMetaStale = true
        return
      case TeamsGen.setTeamAccessRequestsPending:
        draftState.teamAccessRequestsPending = action.payload.accessRequestsPending
        return
      case TeamsGen.setNewTeamInfo: {
        draftState.deletedTeams = action.payload.deletedTeams
        draftState.newTeams = action.payload.newTeams
        draftState.teamNameToResetUsers = action.payload.teamNameToResetUsers

        const newTeamRequests = new Map<Types.TeamID, number>()
        const newTeamRequestsByName = new Map<string, number>()
        action.payload.newTeamRequests.forEach(teamID => {
          newTeamRequests.set(teamID, (newTeamRequests.get(teamID) || 0) + 1)
          const teamname = (state.teamDetails.get(teamID) || Constants.emptyTeamDetails).teamname
          if (teamname) {
            newTeamRequestsByName.set(teamname, (newTeamRequestsByName.get(teamname) || 0) + 1)
          }
        })
        draftState.newTeamRequests = newTeamRequests
        draftState.newTeamRequestsByName = newTeamRequestsByName
        return
      }
      case TeamsGen.setTeamProfileAddList:
        draftState.teamProfileAddList = action.payload.teamlist
        return
      case TeamsGen.setTeamSawChatBanner:
        draftState.sawChatBanner = true
        return
      case TeamsGen.setTeamSawSubteamsBanner:
        draftState.sawSubteamsBanner = true
        return
      case TeamsGen.setTeamsWithChosenChannels:
        draftState.teamsWithChosenChannels = action.payload.teamsWithChosenChannels
        return
      case TeamsGen.setUpdatedChannelName:
        draftState.teamNameToChannelInfos = draftState.teamNameToChannelInfos.update(
          action.payload.teamname,
          map =>
            map.update(action.payload.conversationIDKey, (channelInfo = Constants.makeChannelInfo()) =>
              channelInfo.merge({channelname: action.payload.newChannelName})
            )
        )
        return
      case TeamsGen.setUpdatedTopic:
        draftState.teamNameToChannelInfos = draftState.teamNameToChannelInfos.update(
          action.payload.teamname,
          map =>
            map.update(action.payload.conversationIDKey, (channelInfo = Constants.makeChannelInfo()) =>
              channelInfo.merge({description: action.payload.newTopic})
            )
        )
        return
      case TeamsGen.deleteChannelInfo:
        draftState.teamNameToChannelInfos = draftState.teamNameToChannelInfos.deleteIn([
          action.payload.teamname,
          action.payload.conversationIDKey,
        ])
        return
      case TeamsGen.addParticipant:
        draftState.teamNameToChannelInfos = draftState.teamNameToChannelInfos.updateIn(
          [action.payload.teamname, action.payload.conversationIDKey, 'memberStatus'],
          () => RPCChatTypes.ConversationMemberStatus.active
        )
        return
      case TeamsGen.removeParticipant:
        draftState.teamNameToChannelInfos = draftState.teamNameToChannelInfos.updateIn(
          [action.payload.teamname, action.payload.conversationIDKey, 'memberStatus'],
          () => RPCChatTypes.ConversationMemberStatus.left
        )
        return
      case TeamsGen.setTeamRoleMapLatestKnownVersion: {
        draftState.teamRoleMap.latestKnownVersion = action.payload.version
        return
      }
      case TeamsGen.setTeamRoleMap: {
        draftState.teamRoleMap = {
          latestKnownVersion: Math.max(
            action.payload.map.latestKnownVersion,
            draftState.teamRoleMap.latestKnownVersion
          ),
          loadedVersion: action.payload.map.loadedVersion,
          roles: action.payload.map.roles,
        }
        return
      }

      case TeamBuildingGen.tbResetStore:
      case TeamBuildingGen.cancelTeamBuilding:
      case TeamBuildingGen.addUsersToTeamSoFar:
      case TeamBuildingGen.removeUsersFromTeamSoFar:
      case TeamBuildingGen.searchResultsLoaded:
      case TeamBuildingGen.finishedTeamBuilding:
      case TeamBuildingGen.fetchedUserRecs:
      case TeamBuildingGen.fetchUserRecs:
      case TeamBuildingGen.search:
      case TeamBuildingGen.selectRole:
      case TeamBuildingGen.labelsSeen:
      case TeamBuildingGen.changeSendNotification: {
        const val = editTeambuildingDraft('teams', draftState.teamBuilding, action)
        if (val !== undefined) {
          draftState.teamBuilding = val
        }
        return
      }
      // Saga-only actions
      case TeamsGen.addUserToTeams:
      case TeamsGen.addToTeam:
      case TeamsGen.reAddToTeam:
      case TeamsGen.checkRequestedAccess:
      case TeamsGen.clearNavBadges:
      case TeamsGen.createChannel:
      case TeamsGen.deleteChannelConfirmed:
      case TeamsGen.deleteTeam:
      case TeamsGen.editMembership:
      case TeamsGen.editTeamDescription:
      case TeamsGen.uploadTeamAvatar:
      case TeamsGen.getChannelInfo:
      case TeamsGen.getChannels:
      case TeamsGen.getDetails:
      case TeamsGen.getMembers:
      case TeamsGen.getTeamProfileAddList:
      case TeamsGen.getTeamPublicity:
      case TeamsGen.getTeamRetentionPolicy:
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
  })
