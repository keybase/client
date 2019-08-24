// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as ChatTypes from '../constants/types/chat2'
import * as Types from '../constants/types/teams'
import {RetentionPolicy} from '../constants/types/retention-policy'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const addParticipant = 'teams:addParticipant'
export const addTeamWithChosenChannels = 'teams:addTeamWithChosenChannels'
export const addToTeam = 'teams:addToTeam'
export const addUserToTeams = 'teams:addUserToTeams'
export const badgeAppForTeams = 'teams:badgeAppForTeams'
export const checkRequestedAccess = 'teams:checkRequestedAccess'
export const clearAddUserToTeamsResults = 'teams:clearAddUserToTeamsResults'
export const clearNavBadges = 'teams:clearNavBadges'
export const clearTeamRequests = 'teams:clearTeamRequests'
export const createChannel = 'teams:createChannel'
export const createNewTeam = 'teams:createNewTeam'
export const createNewTeamFromConversation = 'teams:createNewTeamFromConversation'
export const deleteChannelConfirmed = 'teams:deleteChannelConfirmed'
export const deleteChannelInfo = 'teams:deleteChannelInfo'
export const deleteTeam = 'teams:deleteTeam'
export const editMembership = 'teams:editMembership'
export const editTeamDescription = 'teams:editTeamDescription'
export const getChannelInfo = 'teams:getChannelInfo'
export const getChannels = 'teams:getChannels'
export const getDetails = 'teams:getDetails'
export const getDetailsForAllTeams = 'teams:getDetailsForAllTeams'
export const getMembers = 'teams:getMembers'
export const getTeamOperations = 'teams:getTeamOperations'
export const getTeamProfileAddList = 'teams:getTeamProfileAddList'
export const getTeamPublicity = 'teams:getTeamPublicity'
export const getTeamRetentionPolicy = 'teams:getTeamRetentionPolicy'
export const getTeams = 'teams:getTeams'
export const ignoreRequest = 'teams:ignoreRequest'
export const inviteToTeamByEmail = 'teams:inviteToTeamByEmail'
export const inviteToTeamByPhone = 'teams:inviteToTeamByPhone'
export const joinTeam = 'teams:joinTeam'
export const leaveTeam = 'teams:leaveTeam'
export const leftTeam = 'teams:leftTeam'
export const reAddToTeam = 'teams:reAddToTeam'
export const removeMemberOrPendingInvite = 'teams:removeMemberOrPendingInvite'
export const removeParticipant = 'teams:removeParticipant'
export const renameTeam = 'teams:renameTeam'
export const saveChannelMembership = 'teams:saveChannelMembership'
export const saveTeamRetentionPolicy = 'teams:saveTeamRetentionPolicy'
export const setAddUserToTeamsResults = 'teams:setAddUserToTeamsResults'
export const setChannelCreationError = 'teams:setChannelCreationError'
export const setEmailInviteError = 'teams:setEmailInviteError'
export const setMemberPublicity = 'teams:setMemberPublicity'
export const setMembers = 'teams:setMembers'
export const setNewTeamInfo = 'teams:setNewTeamInfo'
export const setPublicity = 'teams:setPublicity'
export const setTeamAccessRequestsPending = 'teams:setTeamAccessRequestsPending'
export const setTeamCanPerform = 'teams:setTeamCanPerform'
export const setTeamChannelInfo = 'teams:setTeamChannelInfo'
export const setTeamChannels = 'teams:setTeamChannels'
export const setTeamCreationError = 'teams:setTeamCreationError'
export const setTeamDetails = 'teams:setTeamDetails'
export const setTeamInfo = 'teams:setTeamInfo'
export const setTeamInviteError = 'teams:setTeamInviteError'
export const setTeamJoinError = 'teams:setTeamJoinError'
export const setTeamJoinSuccess = 'teams:setTeamJoinSuccess'
export const setTeamLoadingInvites = 'teams:setTeamLoadingInvites'
export const setTeamProfileAddList = 'teams:setTeamProfileAddList'
export const setTeamPublicitySettings = 'teams:setTeamPublicitySettings'
export const setTeamRetentionPolicy = 'teams:setTeamRetentionPolicy'
export const setTeamSawChatBanner = 'teams:setTeamSawChatBanner'
export const setTeamSawSubteamsBanner = 'teams:setTeamSawSubteamsBanner'
export const setTeamsWithChosenChannels = 'teams:setTeamsWithChosenChannels'
export const setUpdatedChannelName = 'teams:setUpdatedChannelName'
export const setUpdatedTopic = 'teams:setUpdatedTopic'
export const updateChannelName = 'teams:updateChannelName'
export const updateTopic = 'teams:updateTopic'
export const uploadTeamAvatar = 'teams:uploadTeamAvatar'

// Payload Types
type _AddParticipantPayload = {
  readonly teamname: string
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}
type _AddTeamWithChosenChannelsPayload = {readonly teamname: string}
type _AddToTeamPayload = {
  readonly teamname: string
  readonly username: string
  readonly role: Types.TeamRoleType
  readonly sendChatNotification: boolean
}
type _AddUserToTeamsPayload = {
  readonly role: Types.TeamRoleType
  readonly teams: Array<string>
  readonly user: string
}
type _BadgeAppForTeamsPayload = {
  readonly deletedTeams: I.List<RPCTypes.DeletedTeamInfo>
  readonly newTeamNames: I.List<string>
  readonly newTeamAccessRequests: I.List<string>
  readonly teamsWithResetUsers: ReadonlyArray<{id: Buffer; teamname: string; username: string; uid: string}>
}
type _CheckRequestedAccessPayload = {readonly teamname: string}
type _ClearAddUserToTeamsResultsPayload = void
type _ClearNavBadgesPayload = void
type _ClearTeamRequestsPayload = {readonly teamname: string}
type _CreateChannelPayload = {
  readonly teamname: string
  readonly channelname: string
  readonly description: string | null
  readonly rootPath?: I.List<string>
  readonly sourceSubPath?: I.List<string>
  readonly destSubPath?: I.List<string>
}
type _CreateNewTeamFromConversationPayload = {
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly teamname: string
}
type _CreateNewTeamPayload = {
  readonly joinSubteam: boolean
  readonly teamname: string
  readonly rootPath?: I.List<string>
  readonly sourceSubPath?: I.List<string>
  readonly destSubPath?: I.List<string>
}
type _DeleteChannelConfirmedPayload = {
  readonly teamname: Types.Teamname
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}
type _DeleteChannelInfoPayload = {
  readonly teamname: Types.Teamname
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}
type _DeleteTeamPayload = {readonly teamname: string}
type _EditMembershipPayload = {
  readonly teamname: string
  readonly username: string
  readonly role: Types.TeamRoleType
}
type _EditTeamDescriptionPayload = {readonly teamname: string; readonly description: string}
type _GetChannelInfoPayload = {
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly teamname: string
}
type _GetChannelsPayload = {readonly teamname: string}
type _GetDetailsForAllTeamsPayload = void
type _GetDetailsPayload = {readonly teamname: string}
type _GetMembersPayload = {readonly teamname: string}
type _GetTeamOperationsPayload = {readonly teamname: string}
type _GetTeamProfileAddListPayload = {readonly username: string}
type _GetTeamPublicityPayload = {readonly teamname: string}
type _GetTeamRetentionPolicyPayload = {readonly teamname: string}
type _GetTeamsPayload = void
type _IgnoreRequestPayload = {readonly teamname: string; readonly username: string}
type _InviteToTeamByEmailPayload = {
  readonly destSubPath?: I.List<string>
  readonly invitees: string
  readonly role: Types.TeamRoleType
  readonly rootPath?: I.List<string>
  readonly sourceSubPath?: I.List<string>
  readonly teamname: string
}
type _InviteToTeamByPhonePayload = {
  readonly teamname: string
  readonly role: Types.TeamRoleType
  readonly phoneNumber: string
  readonly fullName: string
}
type _JoinTeamPayload = {readonly teamname: string}
type _LeaveTeamPayload = {readonly teamname: string; readonly context: 'teams' | 'chat'}
type _LeftTeamPayload = {readonly teamname: string; readonly context: 'teams' | 'chat'}
type _ReAddToTeamPayload = {readonly teamname: string; readonly username: string}
type _RemoveMemberOrPendingInvitePayload = {
  readonly email: string
  readonly teamname: string
  readonly username: string
  readonly inviteID: string
}
type _RemoveParticipantPayload = {
  readonly teamname: string
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}
type _RenameTeamPayload = {readonly oldName: string; readonly newName: string}
type _SaveChannelMembershipPayload = {
  readonly teamname: string
  readonly oldChannelState: Types.ChannelMembershipState
  readonly newChannelState: Types.ChannelMembershipState
}
type _SaveTeamRetentionPolicyPayload = {readonly teamname: string; readonly policy: RetentionPolicy}
type _SetAddUserToTeamsResultsPayload = {readonly error: boolean; readonly results: string}
type _SetChannelCreationErrorPayload = {readonly error: string}
type _SetEmailInviteErrorPayload = {readonly message: string; readonly malformed: Array<string>}
type _SetMemberPublicityPayload = {readonly teamname: string; readonly showcase: boolean}
type _SetMembersPayload = {readonly teamname: string; readonly members: I.Map<string, Types.MemberInfo>}
type _SetNewTeamInfoPayload = {
  readonly deletedTeams: I.List<RPCTypes.DeletedTeamInfo>
  readonly newTeams: I.Set<string>
  readonly newTeamRequests: I.List<string>
  readonly teamNameToResetUsers: I.Map<Types.Teamname, I.Set<Types.ResetUser>>
}
type _SetPublicityPayload = {readonly teamname: string; readonly settings: Types.PublicitySettings}
type _SetTeamAccessRequestsPendingPayload = {readonly accessRequestsPending: I.Set<Types.Teamname>}
type _SetTeamCanPerformPayload = {readonly teamname: string; readonly teamOperation: Types.TeamOperations}
type _SetTeamChannelInfoPayload = {
  readonly teamname: string
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly channelInfo: Types.ChannelInfo
}
type _SetTeamChannelsPayload = {
  readonly teamname: string
  readonly channelInfos: I.Map<ChatTypes.ConversationIDKey, Types.ChannelInfo>
}
type _SetTeamCreationErrorPayload = {readonly error: string}
type _SetTeamDetailsPayload = {
  readonly teamname: string
  readonly members: I.Map<string, Types.MemberInfo>
  readonly settings: Types.TeamSettings
  readonly invites: I.Set<Types.InviteInfo>
  readonly subteams: I.Set<Types.Teamname>
  readonly requests: I.Map<string, I.Set<Types.RequestInfo>>
}
type _SetTeamInfoPayload = {
  readonly teamnames: I.Set<Types.Teamname>
  readonly teammembercounts: I.Map<Types.Teamname, number>
  readonly teamNameToIsOpen: I.Map<Types.Teamname, boolean>
  readonly teamNameToRole: I.Map<Types.Teamname, Types.MaybeTeamRoleType>
  readonly teamNameToAllowPromote: I.Map<Types.Teamname, boolean>
  readonly teamNameToIsShowcasing: I.Map<Types.Teamname, boolean>
  readonly teamNameToID: I.Map<Types.Teamname, string>
}
type _SetTeamInviteErrorPayload = {readonly error: string}
type _SetTeamJoinErrorPayload = {readonly error: string}
type _SetTeamJoinSuccessPayload = {readonly success: boolean; readonly teamname: string}
type _SetTeamLoadingInvitesPayload = {
  readonly teamname: string
  readonly invitees: string
  readonly loadingInvites: boolean
}
type _SetTeamProfileAddListPayload = {readonly teamlist: I.List<Types.TeamProfileAddList>}
type _SetTeamPublicitySettingsPayload = {
  readonly teamname: string
  readonly publicity: Types._PublicitySettings
}
type _SetTeamRetentionPolicyPayload = {readonly teamname: string; readonly retentionPolicy: RetentionPolicy}
type _SetTeamSawChatBannerPayload = void
type _SetTeamSawSubteamsBannerPayload = void
type _SetTeamsWithChosenChannelsPayload = {readonly teamsWithChosenChannels: I.Set<Types.Teamname>}
type _SetUpdatedChannelNamePayload = {
  readonly teamname: Types.Teamname
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newChannelName: string
}
type _SetUpdatedTopicPayload = {
  readonly teamname: Types.Teamname
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newTopic: string
}
type _UpdateChannelNamePayload = {
  readonly teamname: Types.Teamname
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newChannelName: string
}
type _UpdateTopicPayload = {
  readonly teamname: Types.Teamname
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newTopic: string
}
type _UploadTeamAvatarPayload = {
  readonly crop?: RPCTypes.ImageCropRect
  readonly filename: string
  readonly sendChatNotification: boolean
  readonly teamname: string
}

// Action Creators
/**
 * Fetches the channel information for a single channel in a team from the server.
 */
export const createGetChannelInfo = (payload: _GetChannelInfoPayload): GetChannelInfoPayload => ({
  payload,
  type: getChannelInfo,
})
/**
 * Fetches the channel information for all channels in a team from the server. Should only be called for components that need the full list.
 */
export const createGetChannels = (payload: _GetChannelsPayload): GetChannelsPayload => ({
  payload,
  type: getChannels,
})
/**
 * Gets the team retention policy and stores in `state.entities.teams.teamNameToRetentionPolicy`.
 */
export const createGetTeamRetentionPolicy = (
  payload: _GetTeamRetentionPolicyPayload
): GetTeamRetentionPolicyPayload => ({payload, type: getTeamRetentionPolicy})
/**
 * Rename a subteam
 */
export const createRenameTeam = (payload: _RenameTeamPayload): RenameTeamPayload => ({
  payload,
  type: renameTeam,
})
/**
 * Sets the retention policy for a team. The store will be updated automatically.
 */
export const createSaveTeamRetentionPolicy = (
  payload: _SaveTeamRetentionPolicyPayload
): SaveTeamRetentionPolicyPayload => ({payload, type: saveTeamRetentionPolicy})
/**
 * We successfully left a team
 */
export const createLeftTeam = (payload: _LeftTeamPayload): LeftTeamPayload => ({payload, type: leftTeam})
export const createAddParticipant = (payload: _AddParticipantPayload): AddParticipantPayload => ({
  payload,
  type: addParticipant,
})
export const createAddTeamWithChosenChannels = (
  payload: _AddTeamWithChosenChannelsPayload
): AddTeamWithChosenChannelsPayload => ({payload, type: addTeamWithChosenChannels})
export const createAddToTeam = (payload: _AddToTeamPayload): AddToTeamPayload => ({payload, type: addToTeam})
export const createAddUserToTeams = (payload: _AddUserToTeamsPayload): AddUserToTeamsPayload => ({
  payload,
  type: addUserToTeams,
})
export const createBadgeAppForTeams = (payload: _BadgeAppForTeamsPayload): BadgeAppForTeamsPayload => ({
  payload,
  type: badgeAppForTeams,
})
export const createCheckRequestedAccess = (
  payload: _CheckRequestedAccessPayload
): CheckRequestedAccessPayload => ({payload, type: checkRequestedAccess})
export const createClearAddUserToTeamsResults = (
  payload: _ClearAddUserToTeamsResultsPayload
): ClearAddUserToTeamsResultsPayload => ({payload, type: clearAddUserToTeamsResults})
export const createClearNavBadges = (payload: _ClearNavBadgesPayload): ClearNavBadgesPayload => ({
  payload,
  type: clearNavBadges,
})
export const createClearTeamRequests = (payload: _ClearTeamRequestsPayload): ClearTeamRequestsPayload => ({
  payload,
  type: clearTeamRequests,
})
export const createCreateChannel = (payload: _CreateChannelPayload): CreateChannelPayload => ({
  payload,
  type: createChannel,
})
export const createCreateNewTeam = (payload: _CreateNewTeamPayload): CreateNewTeamPayload => ({
  payload,
  type: createNewTeam,
})
export const createCreateNewTeamFromConversation = (
  payload: _CreateNewTeamFromConversationPayload
): CreateNewTeamFromConversationPayload => ({payload, type: createNewTeamFromConversation})
export const createDeleteChannelConfirmed = (
  payload: _DeleteChannelConfirmedPayload
): DeleteChannelConfirmedPayload => ({payload, type: deleteChannelConfirmed})
export const createDeleteChannelInfo = (payload: _DeleteChannelInfoPayload): DeleteChannelInfoPayload => ({
  payload,
  type: deleteChannelInfo,
})
export const createDeleteTeam = (payload: _DeleteTeamPayload): DeleteTeamPayload => ({
  payload,
  type: deleteTeam,
})
export const createEditMembership = (payload: _EditMembershipPayload): EditMembershipPayload => ({
  payload,
  type: editMembership,
})
export const createEditTeamDescription = (
  payload: _EditTeamDescriptionPayload
): EditTeamDescriptionPayload => ({payload, type: editTeamDescription})
export const createGetDetails = (payload: _GetDetailsPayload): GetDetailsPayload => ({
  payload,
  type: getDetails,
})
export const createGetDetailsForAllTeams = (
  payload: _GetDetailsForAllTeamsPayload
): GetDetailsForAllTeamsPayload => ({payload, type: getDetailsForAllTeams})
export const createGetMembers = (payload: _GetMembersPayload): GetMembersPayload => ({
  payload,
  type: getMembers,
})
export const createGetTeamOperations = (payload: _GetTeamOperationsPayload): GetTeamOperationsPayload => ({
  payload,
  type: getTeamOperations,
})
export const createGetTeamProfileAddList = (
  payload: _GetTeamProfileAddListPayload
): GetTeamProfileAddListPayload => ({payload, type: getTeamProfileAddList})
export const createGetTeamPublicity = (payload: _GetTeamPublicityPayload): GetTeamPublicityPayload => ({
  payload,
  type: getTeamPublicity,
})
export const createGetTeams = (payload: _GetTeamsPayload): GetTeamsPayload => ({payload, type: getTeams})
export const createIgnoreRequest = (payload: _IgnoreRequestPayload): IgnoreRequestPayload => ({
  payload,
  type: ignoreRequest,
})
export const createInviteToTeamByEmail = (
  payload: _InviteToTeamByEmailPayload
): InviteToTeamByEmailPayload => ({payload, type: inviteToTeamByEmail})
export const createInviteToTeamByPhone = (
  payload: _InviteToTeamByPhonePayload
): InviteToTeamByPhonePayload => ({payload, type: inviteToTeamByPhone})
export const createJoinTeam = (payload: _JoinTeamPayload): JoinTeamPayload => ({payload, type: joinTeam})
export const createLeaveTeam = (payload: _LeaveTeamPayload): LeaveTeamPayload => ({payload, type: leaveTeam})
export const createReAddToTeam = (payload: _ReAddToTeamPayload): ReAddToTeamPayload => ({
  payload,
  type: reAddToTeam,
})
export const createRemoveMemberOrPendingInvite = (
  payload: _RemoveMemberOrPendingInvitePayload
): RemoveMemberOrPendingInvitePayload => ({payload, type: removeMemberOrPendingInvite})
export const createRemoveParticipant = (payload: _RemoveParticipantPayload): RemoveParticipantPayload => ({
  payload,
  type: removeParticipant,
})
export const createSaveChannelMembership = (
  payload: _SaveChannelMembershipPayload
): SaveChannelMembershipPayload => ({payload, type: saveChannelMembership})
export const createSetAddUserToTeamsResults = (
  payload: _SetAddUserToTeamsResultsPayload
): SetAddUserToTeamsResultsPayload => ({payload, type: setAddUserToTeamsResults})
export const createSetChannelCreationError = (
  payload: _SetChannelCreationErrorPayload
): SetChannelCreationErrorPayload => ({payload, type: setChannelCreationError})
export const createSetEmailInviteError = (
  payload: _SetEmailInviteErrorPayload
): SetEmailInviteErrorPayload => ({payload, type: setEmailInviteError})
export const createSetMemberPublicity = (payload: _SetMemberPublicityPayload): SetMemberPublicityPayload => ({
  payload,
  type: setMemberPublicity,
})
export const createSetMembers = (payload: _SetMembersPayload): SetMembersPayload => ({
  payload,
  type: setMembers,
})
export const createSetNewTeamInfo = (payload: _SetNewTeamInfoPayload): SetNewTeamInfoPayload => ({
  payload,
  type: setNewTeamInfo,
})
export const createSetPublicity = (payload: _SetPublicityPayload): SetPublicityPayload => ({
  payload,
  type: setPublicity,
})
export const createSetTeamAccessRequestsPending = (
  payload: _SetTeamAccessRequestsPendingPayload
): SetTeamAccessRequestsPendingPayload => ({payload, type: setTeamAccessRequestsPending})
export const createSetTeamCanPerform = (payload: _SetTeamCanPerformPayload): SetTeamCanPerformPayload => ({
  payload,
  type: setTeamCanPerform,
})
export const createSetTeamChannelInfo = (payload: _SetTeamChannelInfoPayload): SetTeamChannelInfoPayload => ({
  payload,
  type: setTeamChannelInfo,
})
export const createSetTeamChannels = (payload: _SetTeamChannelsPayload): SetTeamChannelsPayload => ({
  payload,
  type: setTeamChannels,
})
export const createSetTeamCreationError = (
  payload: _SetTeamCreationErrorPayload
): SetTeamCreationErrorPayload => ({payload, type: setTeamCreationError})
export const createSetTeamDetails = (payload: _SetTeamDetailsPayload): SetTeamDetailsPayload => ({
  payload,
  type: setTeamDetails,
})
export const createSetTeamInfo = (payload: _SetTeamInfoPayload): SetTeamInfoPayload => ({
  payload,
  type: setTeamInfo,
})
export const createSetTeamInviteError = (payload: _SetTeamInviteErrorPayload): SetTeamInviteErrorPayload => ({
  payload,
  type: setTeamInviteError,
})
export const createSetTeamJoinError = (payload: _SetTeamJoinErrorPayload): SetTeamJoinErrorPayload => ({
  payload,
  type: setTeamJoinError,
})
export const createSetTeamJoinSuccess = (payload: _SetTeamJoinSuccessPayload): SetTeamJoinSuccessPayload => ({
  payload,
  type: setTeamJoinSuccess,
})
export const createSetTeamLoadingInvites = (
  payload: _SetTeamLoadingInvitesPayload
): SetTeamLoadingInvitesPayload => ({payload, type: setTeamLoadingInvites})
export const createSetTeamProfileAddList = (
  payload: _SetTeamProfileAddListPayload
): SetTeamProfileAddListPayload => ({payload, type: setTeamProfileAddList})
export const createSetTeamPublicitySettings = (
  payload: _SetTeamPublicitySettingsPayload
): SetTeamPublicitySettingsPayload => ({payload, type: setTeamPublicitySettings})
export const createSetTeamRetentionPolicy = (
  payload: _SetTeamRetentionPolicyPayload
): SetTeamRetentionPolicyPayload => ({payload, type: setTeamRetentionPolicy})
export const createSetTeamSawChatBanner = (
  payload: _SetTeamSawChatBannerPayload
): SetTeamSawChatBannerPayload => ({payload, type: setTeamSawChatBanner})
export const createSetTeamSawSubteamsBanner = (
  payload: _SetTeamSawSubteamsBannerPayload
): SetTeamSawSubteamsBannerPayload => ({payload, type: setTeamSawSubteamsBanner})
export const createSetTeamsWithChosenChannels = (
  payload: _SetTeamsWithChosenChannelsPayload
): SetTeamsWithChosenChannelsPayload => ({payload, type: setTeamsWithChosenChannels})
export const createSetUpdatedChannelName = (
  payload: _SetUpdatedChannelNamePayload
): SetUpdatedChannelNamePayload => ({payload, type: setUpdatedChannelName})
export const createSetUpdatedTopic = (payload: _SetUpdatedTopicPayload): SetUpdatedTopicPayload => ({
  payload,
  type: setUpdatedTopic,
})
export const createUpdateChannelName = (payload: _UpdateChannelNamePayload): UpdateChannelNamePayload => ({
  payload,
  type: updateChannelName,
})
export const createUpdateTopic = (payload: _UpdateTopicPayload): UpdateTopicPayload => ({
  payload,
  type: updateTopic,
})
export const createUploadTeamAvatar = (payload: _UploadTeamAvatarPayload): UploadTeamAvatarPayload => ({
  payload,
  type: uploadTeamAvatar,
})

// Action Payloads
export type AddParticipantPayload = {
  readonly payload: _AddParticipantPayload
  readonly type: typeof addParticipant
}
export type AddTeamWithChosenChannelsPayload = {
  readonly payload: _AddTeamWithChosenChannelsPayload
  readonly type: typeof addTeamWithChosenChannels
}
export type AddToTeamPayload = {readonly payload: _AddToTeamPayload; readonly type: typeof addToTeam}
export type AddUserToTeamsPayload = {
  readonly payload: _AddUserToTeamsPayload
  readonly type: typeof addUserToTeams
}
export type BadgeAppForTeamsPayload = {
  readonly payload: _BadgeAppForTeamsPayload
  readonly type: typeof badgeAppForTeams
}
export type CheckRequestedAccessPayload = {
  readonly payload: _CheckRequestedAccessPayload
  readonly type: typeof checkRequestedAccess
}
export type ClearAddUserToTeamsResultsPayload = {
  readonly payload: _ClearAddUserToTeamsResultsPayload
  readonly type: typeof clearAddUserToTeamsResults
}
export type ClearNavBadgesPayload = {
  readonly payload: _ClearNavBadgesPayload
  readonly type: typeof clearNavBadges
}
export type ClearTeamRequestsPayload = {
  readonly payload: _ClearTeamRequestsPayload
  readonly type: typeof clearTeamRequests
}
export type CreateChannelPayload = {
  readonly payload: _CreateChannelPayload
  readonly type: typeof createChannel
}
export type CreateNewTeamFromConversationPayload = {
  readonly payload: _CreateNewTeamFromConversationPayload
  readonly type: typeof createNewTeamFromConversation
}
export type CreateNewTeamPayload = {
  readonly payload: _CreateNewTeamPayload
  readonly type: typeof createNewTeam
}
export type DeleteChannelConfirmedPayload = {
  readonly payload: _DeleteChannelConfirmedPayload
  readonly type: typeof deleteChannelConfirmed
}
export type DeleteChannelInfoPayload = {
  readonly payload: _DeleteChannelInfoPayload
  readonly type: typeof deleteChannelInfo
}
export type DeleteTeamPayload = {readonly payload: _DeleteTeamPayload; readonly type: typeof deleteTeam}
export type EditMembershipPayload = {
  readonly payload: _EditMembershipPayload
  readonly type: typeof editMembership
}
export type EditTeamDescriptionPayload = {
  readonly payload: _EditTeamDescriptionPayload
  readonly type: typeof editTeamDescription
}
export type GetChannelInfoPayload = {
  readonly payload: _GetChannelInfoPayload
  readonly type: typeof getChannelInfo
}
export type GetChannelsPayload = {readonly payload: _GetChannelsPayload; readonly type: typeof getChannels}
export type GetDetailsForAllTeamsPayload = {
  readonly payload: _GetDetailsForAllTeamsPayload
  readonly type: typeof getDetailsForAllTeams
}
export type GetDetailsPayload = {readonly payload: _GetDetailsPayload; readonly type: typeof getDetails}
export type GetMembersPayload = {readonly payload: _GetMembersPayload; readonly type: typeof getMembers}
export type GetTeamOperationsPayload = {
  readonly payload: _GetTeamOperationsPayload
  readonly type: typeof getTeamOperations
}
export type GetTeamProfileAddListPayload = {
  readonly payload: _GetTeamProfileAddListPayload
  readonly type: typeof getTeamProfileAddList
}
export type GetTeamPublicityPayload = {
  readonly payload: _GetTeamPublicityPayload
  readonly type: typeof getTeamPublicity
}
export type GetTeamRetentionPolicyPayload = {
  readonly payload: _GetTeamRetentionPolicyPayload
  readonly type: typeof getTeamRetentionPolicy
}
export type GetTeamsPayload = {readonly payload: _GetTeamsPayload; readonly type: typeof getTeams}
export type IgnoreRequestPayload = {
  readonly payload: _IgnoreRequestPayload
  readonly type: typeof ignoreRequest
}
export type InviteToTeamByEmailPayload = {
  readonly payload: _InviteToTeamByEmailPayload
  readonly type: typeof inviteToTeamByEmail
}
export type InviteToTeamByPhonePayload = {
  readonly payload: _InviteToTeamByPhonePayload
  readonly type: typeof inviteToTeamByPhone
}
export type JoinTeamPayload = {readonly payload: _JoinTeamPayload; readonly type: typeof joinTeam}
export type LeaveTeamPayload = {readonly payload: _LeaveTeamPayload; readonly type: typeof leaveTeam}
export type LeftTeamPayload = {readonly payload: _LeftTeamPayload; readonly type: typeof leftTeam}
export type ReAddToTeamPayload = {readonly payload: _ReAddToTeamPayload; readonly type: typeof reAddToTeam}
export type RemoveMemberOrPendingInvitePayload = {
  readonly payload: _RemoveMemberOrPendingInvitePayload
  readonly type: typeof removeMemberOrPendingInvite
}
export type RemoveParticipantPayload = {
  readonly payload: _RemoveParticipantPayload
  readonly type: typeof removeParticipant
}
export type RenameTeamPayload = {readonly payload: _RenameTeamPayload; readonly type: typeof renameTeam}
export type SaveChannelMembershipPayload = {
  readonly payload: _SaveChannelMembershipPayload
  readonly type: typeof saveChannelMembership
}
export type SaveTeamRetentionPolicyPayload = {
  readonly payload: _SaveTeamRetentionPolicyPayload
  readonly type: typeof saveTeamRetentionPolicy
}
export type SetAddUserToTeamsResultsPayload = {
  readonly payload: _SetAddUserToTeamsResultsPayload
  readonly type: typeof setAddUserToTeamsResults
}
export type SetChannelCreationErrorPayload = {
  readonly payload: _SetChannelCreationErrorPayload
  readonly type: typeof setChannelCreationError
}
export type SetEmailInviteErrorPayload = {
  readonly payload: _SetEmailInviteErrorPayload
  readonly type: typeof setEmailInviteError
}
export type SetMemberPublicityPayload = {
  readonly payload: _SetMemberPublicityPayload
  readonly type: typeof setMemberPublicity
}
export type SetMembersPayload = {readonly payload: _SetMembersPayload; readonly type: typeof setMembers}
export type SetNewTeamInfoPayload = {
  readonly payload: _SetNewTeamInfoPayload
  readonly type: typeof setNewTeamInfo
}
export type SetPublicityPayload = {readonly payload: _SetPublicityPayload; readonly type: typeof setPublicity}
export type SetTeamAccessRequestsPendingPayload = {
  readonly payload: _SetTeamAccessRequestsPendingPayload
  readonly type: typeof setTeamAccessRequestsPending
}
export type SetTeamCanPerformPayload = {
  readonly payload: _SetTeamCanPerformPayload
  readonly type: typeof setTeamCanPerform
}
export type SetTeamChannelInfoPayload = {
  readonly payload: _SetTeamChannelInfoPayload
  readonly type: typeof setTeamChannelInfo
}
export type SetTeamChannelsPayload = {
  readonly payload: _SetTeamChannelsPayload
  readonly type: typeof setTeamChannels
}
export type SetTeamCreationErrorPayload = {
  readonly payload: _SetTeamCreationErrorPayload
  readonly type: typeof setTeamCreationError
}
export type SetTeamDetailsPayload = {
  readonly payload: _SetTeamDetailsPayload
  readonly type: typeof setTeamDetails
}
export type SetTeamInfoPayload = {readonly payload: _SetTeamInfoPayload; readonly type: typeof setTeamInfo}
export type SetTeamInviteErrorPayload = {
  readonly payload: _SetTeamInviteErrorPayload
  readonly type: typeof setTeamInviteError
}
export type SetTeamJoinErrorPayload = {
  readonly payload: _SetTeamJoinErrorPayload
  readonly type: typeof setTeamJoinError
}
export type SetTeamJoinSuccessPayload = {
  readonly payload: _SetTeamJoinSuccessPayload
  readonly type: typeof setTeamJoinSuccess
}
export type SetTeamLoadingInvitesPayload = {
  readonly payload: _SetTeamLoadingInvitesPayload
  readonly type: typeof setTeamLoadingInvites
}
export type SetTeamProfileAddListPayload = {
  readonly payload: _SetTeamProfileAddListPayload
  readonly type: typeof setTeamProfileAddList
}
export type SetTeamPublicitySettingsPayload = {
  readonly payload: _SetTeamPublicitySettingsPayload
  readonly type: typeof setTeamPublicitySettings
}
export type SetTeamRetentionPolicyPayload = {
  readonly payload: _SetTeamRetentionPolicyPayload
  readonly type: typeof setTeamRetentionPolicy
}
export type SetTeamSawChatBannerPayload = {
  readonly payload: _SetTeamSawChatBannerPayload
  readonly type: typeof setTeamSawChatBanner
}
export type SetTeamSawSubteamsBannerPayload = {
  readonly payload: _SetTeamSawSubteamsBannerPayload
  readonly type: typeof setTeamSawSubteamsBanner
}
export type SetTeamsWithChosenChannelsPayload = {
  readonly payload: _SetTeamsWithChosenChannelsPayload
  readonly type: typeof setTeamsWithChosenChannels
}
export type SetUpdatedChannelNamePayload = {
  readonly payload: _SetUpdatedChannelNamePayload
  readonly type: typeof setUpdatedChannelName
}
export type SetUpdatedTopicPayload = {
  readonly payload: _SetUpdatedTopicPayload
  readonly type: typeof setUpdatedTopic
}
export type UpdateChannelNamePayload = {
  readonly payload: _UpdateChannelNamePayload
  readonly type: typeof updateChannelName
}
export type UpdateTopicPayload = {readonly payload: _UpdateTopicPayload; readonly type: typeof updateTopic}
export type UploadTeamAvatarPayload = {
  readonly payload: _UploadTeamAvatarPayload
  readonly type: typeof uploadTeamAvatar
}

// All Actions
// prettier-ignore
export type Actions =
  | AddParticipantPayload
  | AddTeamWithChosenChannelsPayload
  | AddToTeamPayload
  | AddUserToTeamsPayload
  | BadgeAppForTeamsPayload
  | CheckRequestedAccessPayload
  | ClearAddUserToTeamsResultsPayload
  | ClearNavBadgesPayload
  | ClearTeamRequestsPayload
  | CreateChannelPayload
  | CreateNewTeamFromConversationPayload
  | CreateNewTeamPayload
  | DeleteChannelConfirmedPayload
  | DeleteChannelInfoPayload
  | DeleteTeamPayload
  | EditMembershipPayload
  | EditTeamDescriptionPayload
  | GetChannelInfoPayload
  | GetChannelsPayload
  | GetDetailsForAllTeamsPayload
  | GetDetailsPayload
  | GetMembersPayload
  | GetTeamOperationsPayload
  | GetTeamProfileAddListPayload
  | GetTeamPublicityPayload
  | GetTeamRetentionPolicyPayload
  | GetTeamsPayload
  | IgnoreRequestPayload
  | InviteToTeamByEmailPayload
  | InviteToTeamByPhonePayload
  | JoinTeamPayload
  | LeaveTeamPayload
  | LeftTeamPayload
  | ReAddToTeamPayload
  | RemoveMemberOrPendingInvitePayload
  | RemoveParticipantPayload
  | RenameTeamPayload
  | SaveChannelMembershipPayload
  | SaveTeamRetentionPolicyPayload
  | SetAddUserToTeamsResultsPayload
  | SetChannelCreationErrorPayload
  | SetEmailInviteErrorPayload
  | SetMemberPublicityPayload
  | SetMembersPayload
  | SetNewTeamInfoPayload
  | SetPublicityPayload
  | SetTeamAccessRequestsPendingPayload
  | SetTeamCanPerformPayload
  | SetTeamChannelInfoPayload
  | SetTeamChannelsPayload
  | SetTeamCreationErrorPayload
  | SetTeamDetailsPayload
  | SetTeamInfoPayload
  | SetTeamInviteErrorPayload
  | SetTeamJoinErrorPayload
  | SetTeamJoinSuccessPayload
  | SetTeamLoadingInvitesPayload
  | SetTeamProfileAddListPayload
  | SetTeamPublicitySettingsPayload
  | SetTeamRetentionPolicyPayload
  | SetTeamSawChatBannerPayload
  | SetTeamSawSubteamsBannerPayload
  | SetTeamsWithChosenChannelsPayload
  | SetUpdatedChannelNamePayload
  | SetUpdatedTopicPayload
  | UpdateChannelNamePayload
  | UpdateTopicPayload
  | UploadTeamAvatarPayload
  | {type: 'common:resetStore', payload: {}}
