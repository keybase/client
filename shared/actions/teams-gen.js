// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as ChatTypes from '../constants/types/chat2'
import * as Types from '../constants/types/teams'
import type {RetentionPolicy} from '../constants/types/retention-policy'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const addParticipant = 'teams:addParticipant'
export const addPeopleToTeam = 'teams:addPeopleToTeam'
export const addTeamWithChosenChannels = 'teams:addTeamWithChosenChannels'
export const addToTeam = 'teams:addToTeam'
export const addUserToTeams = 'teams:addUserToTeams'
export const badgeAppForTeams = 'teams:badgeAppForTeams'
export const checkRequestedAccess = 'teams:checkRequestedAccess'
export const clearTeamRequests = 'teams:clearTeamRequests'
export const createChannel = 'teams:createChannel'
export const createNewTeam = 'teams:createNewTeam'
export const createNewTeamFromConversation = 'teams:createNewTeamFromConversation'
export const deleteChannelConfirmed = 'teams:deleteChannelConfirmed'
export const deleteChannelInfo = 'teams:deleteChannelInfo'
export const editMembership = 'teams:editMembership'
export const editTeamDescription = 'teams:editTeamDescription'
export const getChannelInfo = 'teams:getChannelInfo'
export const getChannels = 'teams:getChannels'
export const getDetails = 'teams:getDetails'
export const getDetailsForAllTeams = 'teams:getDetailsForAllTeams'
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
export const removeMemberOrPendingInvite = 'teams:removeMemberOrPendingInvite'
export const removeParticipant = 'teams:removeParticipant'
export const saveChannelMembership = 'teams:saveChannelMembership'
export const saveTeamRetentionPolicy = 'teams:saveTeamRetentionPolicy'
export const setAddUserToTeamsResults = 'teams:setAddUserToTeamsResults'
export const setChannelCreationError = 'teams:setChannelCreationError'
export const setEmailInviteError = 'teams:setEmailInviteError'
export const setLoaded = 'teams:setLoaded'
export const setMemberPublicity = 'teams:setMemberPublicity'
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
type _AddParticipantPayload = $ReadOnly<{|teamname: string, conversationIDKey: ChatTypes.ConversationIDKey, participant: string|}>
type _AddPeopleToTeamPayload = $ReadOnly<{|destSubPath: I.List<string>, role: string, rootPath: I.List<string>, sendChatNotification: boolean, sourceSubPath: I.List<string>, teamname: string|}>
type _AddTeamWithChosenChannelsPayload = $ReadOnly<{|teamname: string|}>
type _AddToTeamPayload = $ReadOnly<{|teamname: string, username: string, role: Types.TeamRoleType, sendChatNotification: boolean|}>
type _AddUserToTeamsPayload = $ReadOnly<{|role: Types.TeamRoleType, teams: Array<string>, user: string|}>
type _BadgeAppForTeamsPayload = $ReadOnly<{|newTeamNames: Array<string>, newTeamAccessRequests: Array<string>, teamsWithResetUsers: Array<$ReadOnly<{id: Buffer, teamname: string, username: string, uid: string}>>|}>
type _CheckRequestedAccessPayload = $ReadOnly<{|teamname: string|}>
type _ClearTeamRequestsPayload = $ReadOnly<{|teamname: string|}>
type _CreateChannelPayload = $ReadOnly<{|teamname: string, channelname: string, description: ?string, rootPath: I.List<string>, sourceSubPath: I.List<string>, destSubPath: I.List<string>|}>
type _CreateNewTeamFromConversationPayload = $ReadOnly<{|conversationIDKey: ChatTypes.ConversationIDKey, teamname: string|}>
type _CreateNewTeamPayload = $ReadOnly<{|joinSubteam: boolean, teamname: string, rootPath: I.List<string>, sourceSubPath: I.List<string>, destSubPath: I.List<string>|}>
type _DeleteChannelConfirmedPayload = $ReadOnly<{|teamname: Types.Teamname, conversationIDKey: ChatTypes.ConversationIDKey|}>
type _DeleteChannelInfoPayload = $ReadOnly<{|teamname: Types.Teamname, conversationIDKey: ChatTypes.ConversationIDKey|}>
type _EditMembershipPayload = $ReadOnly<{|teamname: string, username: string, role: Types.TeamRoleType|}>
type _EditTeamDescriptionPayload = $ReadOnly<{|teamname: string, description: string|}>
type _GetChannelInfoPayload = $ReadOnly<{|conversationIDKey: ChatTypes.ConversationIDKey, teamname: string|}>
type _GetChannelsPayload = $ReadOnly<{|teamname: string|}>
type _GetDetailsForAllTeamsPayload = void
type _GetDetailsPayload = $ReadOnly<{|teamname: string|}>
type _GetTeamOperationsPayload = $ReadOnly<{|teamname: string|}>
type _GetTeamProfileAddListPayload = $ReadOnly<{|username: string|}>
type _GetTeamPublicityPayload = $ReadOnly<{|teamname: string|}>
type _GetTeamRetentionPolicyPayload = $ReadOnly<{|teamname: string|}>
type _GetTeamsPayload = void
type _IgnoreRequestPayload = $ReadOnly<{|teamname: string, username: string|}>
type _InviteToTeamByEmailPayload = $ReadOnly<{|destSubPath: I.List<string>, invitees: string, role: Types.TeamRoleType, rootPath: I.List<string>, sourceSubPath: I.List<string>, teamname: string|}>
type _InviteToTeamByPhonePayload = $ReadOnly<{|teamname: string, role: Types.TeamRoleType, phoneNumber: string, fullName: string|}>
type _JoinTeamPayload = $ReadOnly<{|teamname: string|}>
type _LeaveTeamPayload = $ReadOnly<{|teamname: string, context: 'teams' | 'chat'|}>
type _LeftTeamPayload = $ReadOnly<{|teamname: string, context: 'teams' | 'chat'|}>
type _RemoveMemberOrPendingInvitePayload = $ReadOnly<{|email: string, teamname: string, username: string, inviteID: string|}>
type _RemoveParticipantPayload = $ReadOnly<{|teamname: string, conversationIDKey: ChatTypes.ConversationIDKey, participant: string|}>
type _SaveChannelMembershipPayload = $ReadOnly<{|teamname: string, oldChannelState: Types.ChannelMembershipState, newChannelState: Types.ChannelMembershipState, you: string|}>
type _SaveTeamRetentionPolicyPayload = $ReadOnly<{|teamname: string, policy: RetentionPolicy|}>
type _SetAddUserToTeamsResultsPayload = $ReadOnly<{|results: string|}>
type _SetChannelCreationErrorPayload = $ReadOnly<{|error: string|}>
type _SetEmailInviteErrorPayload = $ReadOnly<{|message: string, malformed: Array<string>|}>
type _SetLoadedPayload = $ReadOnly<{|loaded: boolean|}>
type _SetMemberPublicityPayload = $ReadOnly<{|teamname: string, showcase: boolean|}>
type _SetNewTeamInfoPayload = $ReadOnly<{|newTeams: I.Set<string>, newTeamRequests: I.List<string>, teamNameToResetUsers: I.Map<Types.Teamname, I.Set<Types.ResetUser>>|}>
type _SetPublicityPayload = $ReadOnly<{|teamname: string, settings: Types.PublicitySettings|}>
type _SetTeamAccessRequestsPendingPayload = $ReadOnly<{|accessRequestsPending: I.Set<Types.Teamname>|}>
type _SetTeamCanPerformPayload = $ReadOnly<{|teamname: string, teamOperation: Types.TeamOperations|}>
type _SetTeamChannelInfoPayload = $ReadOnly<{|teamname: string, conversationIDKey: ChatTypes.ConversationIDKey, channelInfo: Types.ChannelInfo|}>
type _SetTeamChannelsPayload = $ReadOnly<{|teamname: string, channelInfos: I.Map<ChatTypes.ConversationIDKey, Types.ChannelInfo>|}>
type _SetTeamCreationErrorPayload = $ReadOnly<{|error: string|}>
type _SetTeamDetailsPayload = $ReadOnly<{|teamname: string, members: I.Map<string, Types.MemberInfo>, settings: Types.TeamSettings, invites: I.Set<Types.InviteInfo>, subteams: I.Set<Types.Teamname>, requests: I.Map<string, I.Set<Types.RequestInfo>>|}>
type _SetTeamInfoPayload = $ReadOnly<{|teamnames: I.Set<Types.Teamname>, teammembercounts: I.Map<Types.Teamname, number>, teamNameToIsOpen: I.Map<Types.Teamname, boolean>, teamNameToRole: I.Map<Types.Teamname, Types.MaybeTeamRoleType>, teamNameToAllowPromote: I.Map<Types.Teamname, boolean>, teamNameToIsShowcasing: I.Map<Types.Teamname, boolean>, teamNameToID: I.Map<Types.Teamname, string>|}>
type _SetTeamInviteErrorPayload = $ReadOnly<{|error: string|}>
type _SetTeamJoinErrorPayload = $ReadOnly<{|error: string|}>
type _SetTeamJoinSuccessPayload = $ReadOnly<{|success: boolean, teamname: string|}>
type _SetTeamLoadingInvitesPayload = $ReadOnly<{|teamname: string, invitees: string, loadingInvites: boolean|}>
type _SetTeamProfileAddListPayload = $ReadOnly<{|teamlist: I.List<Types.TeamProfileAddList>|}>
type _SetTeamPublicitySettingsPayload = $ReadOnly<{|teamname: string, publicity: Types._PublicitySettings|}>
type _SetTeamRetentionPolicyPayload = $ReadOnly<{|teamname: string, retentionPolicy: RetentionPolicy|}>
type _SetTeamSawChatBannerPayload = void
type _SetTeamSawSubteamsBannerPayload = void
type _SetTeamsWithChosenChannelsPayload = $ReadOnly<{|teamsWithChosenChannels: I.Set<Types.Teamname>|}>
type _SetUpdatedChannelNamePayload = $ReadOnly<{|teamname: Types.Teamname, conversationIDKey: ChatTypes.ConversationIDKey, newChannelName: string|}>
type _SetUpdatedTopicPayload = $ReadOnly<{|teamname: Types.Teamname, conversationIDKey: ChatTypes.ConversationIDKey, newTopic: string|}>
type _UpdateChannelNamePayload = $ReadOnly<{|teamname: Types.Teamname, conversationIDKey: ChatTypes.ConversationIDKey, newChannelName: string|}>
type _UpdateTopicPayload = $ReadOnly<{|teamname: Types.Teamname, conversationIDKey: ChatTypes.ConversationIDKey, newTopic: string|}>
type _UploadTeamAvatarPayload = $ReadOnly<{|crop?: RPCTypes.ImageCropRect, filename: string, sendChatNotification: boolean, teamname: string|}>

// Action Creators
/**
 * Fetches the channel information for a single channel in a team from the server.
 */
export const createGetChannelInfo = (payload: _GetChannelInfoPayload) => ({payload, type: getChannelInfo})
/**
 * Fetches the channel information for all channels in a team from the server. Should only be called for components that need the full list.
 */
export const createGetChannels = (payload: _GetChannelsPayload) => ({payload, type: getChannels})
/**
 * Gets the team retention policy and stores in `state.entities.teams.teamNameToRetentionPolicy`.
 */
export const createGetTeamRetentionPolicy = (payload: _GetTeamRetentionPolicyPayload) => ({payload, type: getTeamRetentionPolicy})
/**
 * Sets the retention policy for a team. The store will be updated automatically.
 */
export const createSaveTeamRetentionPolicy = (payload: _SaveTeamRetentionPolicyPayload) => ({payload, type: saveTeamRetentionPolicy})
/**
 * We successfully left a team
 */
export const createLeftTeam = (payload: _LeftTeamPayload) => ({payload, type: leftTeam})
export const createAddParticipant = (payload: _AddParticipantPayload) => ({payload, type: addParticipant})
export const createAddPeopleToTeam = (payload: _AddPeopleToTeamPayload) => ({payload, type: addPeopleToTeam})
export const createAddTeamWithChosenChannels = (payload: _AddTeamWithChosenChannelsPayload) => ({payload, type: addTeamWithChosenChannels})
export const createAddToTeam = (payload: _AddToTeamPayload) => ({payload, type: addToTeam})
export const createAddUserToTeams = (payload: _AddUserToTeamsPayload) => ({payload, type: addUserToTeams})
export const createBadgeAppForTeams = (payload: _BadgeAppForTeamsPayload) => ({payload, type: badgeAppForTeams})
export const createCheckRequestedAccess = (payload: _CheckRequestedAccessPayload) => ({payload, type: checkRequestedAccess})
export const createClearTeamRequests = (payload: _ClearTeamRequestsPayload) => ({payload, type: clearTeamRequests})
export const createCreateChannel = (payload: _CreateChannelPayload) => ({payload, type: createChannel})
export const createCreateNewTeam = (payload: _CreateNewTeamPayload) => ({payload, type: createNewTeam})
export const createCreateNewTeamFromConversation = (payload: _CreateNewTeamFromConversationPayload) => ({payload, type: createNewTeamFromConversation})
export const createDeleteChannelConfirmed = (payload: _DeleteChannelConfirmedPayload) => ({payload, type: deleteChannelConfirmed})
export const createDeleteChannelInfo = (payload: _DeleteChannelInfoPayload) => ({payload, type: deleteChannelInfo})
export const createEditMembership = (payload: _EditMembershipPayload) => ({payload, type: editMembership})
export const createEditTeamDescription = (payload: _EditTeamDescriptionPayload) => ({payload, type: editTeamDescription})
export const createGetDetails = (payload: _GetDetailsPayload) => ({payload, type: getDetails})
export const createGetDetailsForAllTeams = (payload: _GetDetailsForAllTeamsPayload) => ({payload, type: getDetailsForAllTeams})
export const createGetTeamOperations = (payload: _GetTeamOperationsPayload) => ({payload, type: getTeamOperations})
export const createGetTeamProfileAddList = (payload: _GetTeamProfileAddListPayload) => ({payload, type: getTeamProfileAddList})
export const createGetTeamPublicity = (payload: _GetTeamPublicityPayload) => ({payload, type: getTeamPublicity})
export const createGetTeams = (payload: _GetTeamsPayload) => ({payload, type: getTeams})
export const createIgnoreRequest = (payload: _IgnoreRequestPayload) => ({payload, type: ignoreRequest})
export const createInviteToTeamByEmail = (payload: _InviteToTeamByEmailPayload) => ({payload, type: inviteToTeamByEmail})
export const createInviteToTeamByPhone = (payload: _InviteToTeamByPhonePayload) => ({payload, type: inviteToTeamByPhone})
export const createJoinTeam = (payload: _JoinTeamPayload) => ({payload, type: joinTeam})
export const createLeaveTeam = (payload: _LeaveTeamPayload) => ({payload, type: leaveTeam})
export const createRemoveMemberOrPendingInvite = (payload: _RemoveMemberOrPendingInvitePayload) => ({payload, type: removeMemberOrPendingInvite})
export const createRemoveParticipant = (payload: _RemoveParticipantPayload) => ({payload, type: removeParticipant})
export const createSaveChannelMembership = (payload: _SaveChannelMembershipPayload) => ({payload, type: saveChannelMembership})
export const createSetAddUserToTeamsResults = (payload: _SetAddUserToTeamsResultsPayload) => ({payload, type: setAddUserToTeamsResults})
export const createSetChannelCreationError = (payload: _SetChannelCreationErrorPayload) => ({payload, type: setChannelCreationError})
export const createSetEmailInviteError = (payload: _SetEmailInviteErrorPayload) => ({payload, type: setEmailInviteError})
export const createSetLoaded = (payload: _SetLoadedPayload) => ({payload, type: setLoaded})
export const createSetMemberPublicity = (payload: _SetMemberPublicityPayload) => ({payload, type: setMemberPublicity})
export const createSetNewTeamInfo = (payload: _SetNewTeamInfoPayload) => ({payload, type: setNewTeamInfo})
export const createSetPublicity = (payload: _SetPublicityPayload) => ({payload, type: setPublicity})
export const createSetTeamAccessRequestsPending = (payload: _SetTeamAccessRequestsPendingPayload) => ({payload, type: setTeamAccessRequestsPending})
export const createSetTeamCanPerform = (payload: _SetTeamCanPerformPayload) => ({payload, type: setTeamCanPerform})
export const createSetTeamChannelInfo = (payload: _SetTeamChannelInfoPayload) => ({payload, type: setTeamChannelInfo})
export const createSetTeamChannels = (payload: _SetTeamChannelsPayload) => ({payload, type: setTeamChannels})
export const createSetTeamCreationError = (payload: _SetTeamCreationErrorPayload) => ({payload, type: setTeamCreationError})
export const createSetTeamDetails = (payload: _SetTeamDetailsPayload) => ({payload, type: setTeamDetails})
export const createSetTeamInfo = (payload: _SetTeamInfoPayload) => ({payload, type: setTeamInfo})
export const createSetTeamInviteError = (payload: _SetTeamInviteErrorPayload) => ({payload, type: setTeamInviteError})
export const createSetTeamJoinError = (payload: _SetTeamJoinErrorPayload) => ({payload, type: setTeamJoinError})
export const createSetTeamJoinSuccess = (payload: _SetTeamJoinSuccessPayload) => ({payload, type: setTeamJoinSuccess})
export const createSetTeamLoadingInvites = (payload: _SetTeamLoadingInvitesPayload) => ({payload, type: setTeamLoadingInvites})
export const createSetTeamProfileAddList = (payload: _SetTeamProfileAddListPayload) => ({payload, type: setTeamProfileAddList})
export const createSetTeamPublicitySettings = (payload: _SetTeamPublicitySettingsPayload) => ({payload, type: setTeamPublicitySettings})
export const createSetTeamRetentionPolicy = (payload: _SetTeamRetentionPolicyPayload) => ({payload, type: setTeamRetentionPolicy})
export const createSetTeamSawChatBanner = (payload: _SetTeamSawChatBannerPayload) => ({payload, type: setTeamSawChatBanner})
export const createSetTeamSawSubteamsBanner = (payload: _SetTeamSawSubteamsBannerPayload) => ({payload, type: setTeamSawSubteamsBanner})
export const createSetTeamsWithChosenChannels = (payload: _SetTeamsWithChosenChannelsPayload) => ({payload, type: setTeamsWithChosenChannels})
export const createSetUpdatedChannelName = (payload: _SetUpdatedChannelNamePayload) => ({payload, type: setUpdatedChannelName})
export const createSetUpdatedTopic = (payload: _SetUpdatedTopicPayload) => ({payload, type: setUpdatedTopic})
export const createUpdateChannelName = (payload: _UpdateChannelNamePayload) => ({payload, type: updateChannelName})
export const createUpdateTopic = (payload: _UpdateTopicPayload) => ({payload, type: updateTopic})
export const createUploadTeamAvatar = (payload: _UploadTeamAvatarPayload) => ({payload, type: uploadTeamAvatar})

// Action Payloads
export type AddParticipantPayload = $Call<typeof createAddParticipant, _AddParticipantPayload>
export type AddPeopleToTeamPayload = $Call<typeof createAddPeopleToTeam, _AddPeopleToTeamPayload>
export type AddTeamWithChosenChannelsPayload = $Call<typeof createAddTeamWithChosenChannels, _AddTeamWithChosenChannelsPayload>
export type AddToTeamPayload = $Call<typeof createAddToTeam, _AddToTeamPayload>
export type AddUserToTeamsPayload = $Call<typeof createAddUserToTeams, _AddUserToTeamsPayload>
export type BadgeAppForTeamsPayload = $Call<typeof createBadgeAppForTeams, _BadgeAppForTeamsPayload>
export type CheckRequestedAccessPayload = $Call<typeof createCheckRequestedAccess, _CheckRequestedAccessPayload>
export type ClearTeamRequestsPayload = $Call<typeof createClearTeamRequests, _ClearTeamRequestsPayload>
export type CreateChannelPayload = $Call<typeof createCreateChannel, _CreateChannelPayload>
export type CreateNewTeamFromConversationPayload = $Call<typeof createCreateNewTeamFromConversation, _CreateNewTeamFromConversationPayload>
export type CreateNewTeamPayload = $Call<typeof createCreateNewTeam, _CreateNewTeamPayload>
export type DeleteChannelConfirmedPayload = $Call<typeof createDeleteChannelConfirmed, _DeleteChannelConfirmedPayload>
export type DeleteChannelInfoPayload = $Call<typeof createDeleteChannelInfo, _DeleteChannelInfoPayload>
export type EditMembershipPayload = $Call<typeof createEditMembership, _EditMembershipPayload>
export type EditTeamDescriptionPayload = $Call<typeof createEditTeamDescription, _EditTeamDescriptionPayload>
export type GetChannelInfoPayload = $Call<typeof createGetChannelInfo, _GetChannelInfoPayload>
export type GetChannelsPayload = $Call<typeof createGetChannels, _GetChannelsPayload>
export type GetDetailsForAllTeamsPayload = $Call<typeof createGetDetailsForAllTeams, _GetDetailsForAllTeamsPayload>
export type GetDetailsPayload = $Call<typeof createGetDetails, _GetDetailsPayload>
export type GetTeamOperationsPayload = $Call<typeof createGetTeamOperations, _GetTeamOperationsPayload>
export type GetTeamProfileAddListPayload = $Call<typeof createGetTeamProfileAddList, _GetTeamProfileAddListPayload>
export type GetTeamPublicityPayload = $Call<typeof createGetTeamPublicity, _GetTeamPublicityPayload>
export type GetTeamRetentionPolicyPayload = $Call<typeof createGetTeamRetentionPolicy, _GetTeamRetentionPolicyPayload>
export type GetTeamsPayload = $Call<typeof createGetTeams, _GetTeamsPayload>
export type IgnoreRequestPayload = $Call<typeof createIgnoreRequest, _IgnoreRequestPayload>
export type InviteToTeamByEmailPayload = $Call<typeof createInviteToTeamByEmail, _InviteToTeamByEmailPayload>
export type InviteToTeamByPhonePayload = $Call<typeof createInviteToTeamByPhone, _InviteToTeamByPhonePayload>
export type JoinTeamPayload = $Call<typeof createJoinTeam, _JoinTeamPayload>
export type LeaveTeamPayload = $Call<typeof createLeaveTeam, _LeaveTeamPayload>
export type LeftTeamPayload = $Call<typeof createLeftTeam, _LeftTeamPayload>
export type RemoveMemberOrPendingInvitePayload = $Call<typeof createRemoveMemberOrPendingInvite, _RemoveMemberOrPendingInvitePayload>
export type RemoveParticipantPayload = $Call<typeof createRemoveParticipant, _RemoveParticipantPayload>
export type SaveChannelMembershipPayload = $Call<typeof createSaveChannelMembership, _SaveChannelMembershipPayload>
export type SaveTeamRetentionPolicyPayload = $Call<typeof createSaveTeamRetentionPolicy, _SaveTeamRetentionPolicyPayload>
export type SetAddUserToTeamsResultsPayload = $Call<typeof createSetAddUserToTeamsResults, _SetAddUserToTeamsResultsPayload>
export type SetChannelCreationErrorPayload = $Call<typeof createSetChannelCreationError, _SetChannelCreationErrorPayload>
export type SetEmailInviteErrorPayload = $Call<typeof createSetEmailInviteError, _SetEmailInviteErrorPayload>
export type SetLoadedPayload = $Call<typeof createSetLoaded, _SetLoadedPayload>
export type SetMemberPublicityPayload = $Call<typeof createSetMemberPublicity, _SetMemberPublicityPayload>
export type SetNewTeamInfoPayload = $Call<typeof createSetNewTeamInfo, _SetNewTeamInfoPayload>
export type SetPublicityPayload = $Call<typeof createSetPublicity, _SetPublicityPayload>
export type SetTeamAccessRequestsPendingPayload = $Call<typeof createSetTeamAccessRequestsPending, _SetTeamAccessRequestsPendingPayload>
export type SetTeamCanPerformPayload = $Call<typeof createSetTeamCanPerform, _SetTeamCanPerformPayload>
export type SetTeamChannelInfoPayload = $Call<typeof createSetTeamChannelInfo, _SetTeamChannelInfoPayload>
export type SetTeamChannelsPayload = $Call<typeof createSetTeamChannels, _SetTeamChannelsPayload>
export type SetTeamCreationErrorPayload = $Call<typeof createSetTeamCreationError, _SetTeamCreationErrorPayload>
export type SetTeamDetailsPayload = $Call<typeof createSetTeamDetails, _SetTeamDetailsPayload>
export type SetTeamInfoPayload = $Call<typeof createSetTeamInfo, _SetTeamInfoPayload>
export type SetTeamInviteErrorPayload = $Call<typeof createSetTeamInviteError, _SetTeamInviteErrorPayload>
export type SetTeamJoinErrorPayload = $Call<typeof createSetTeamJoinError, _SetTeamJoinErrorPayload>
export type SetTeamJoinSuccessPayload = $Call<typeof createSetTeamJoinSuccess, _SetTeamJoinSuccessPayload>
export type SetTeamLoadingInvitesPayload = $Call<typeof createSetTeamLoadingInvites, _SetTeamLoadingInvitesPayload>
export type SetTeamProfileAddListPayload = $Call<typeof createSetTeamProfileAddList, _SetTeamProfileAddListPayload>
export type SetTeamPublicitySettingsPayload = $Call<typeof createSetTeamPublicitySettings, _SetTeamPublicitySettingsPayload>
export type SetTeamRetentionPolicyPayload = $Call<typeof createSetTeamRetentionPolicy, _SetTeamRetentionPolicyPayload>
export type SetTeamSawChatBannerPayload = $Call<typeof createSetTeamSawChatBanner, _SetTeamSawChatBannerPayload>
export type SetTeamSawSubteamsBannerPayload = $Call<typeof createSetTeamSawSubteamsBanner, _SetTeamSawSubteamsBannerPayload>
export type SetTeamsWithChosenChannelsPayload = $Call<typeof createSetTeamsWithChosenChannels, _SetTeamsWithChosenChannelsPayload>
export type SetUpdatedChannelNamePayload = $Call<typeof createSetUpdatedChannelName, _SetUpdatedChannelNamePayload>
export type SetUpdatedTopicPayload = $Call<typeof createSetUpdatedTopic, _SetUpdatedTopicPayload>
export type UpdateChannelNamePayload = $Call<typeof createUpdateChannelName, _UpdateChannelNamePayload>
export type UpdateTopicPayload = $Call<typeof createUpdateTopic, _UpdateTopicPayload>
export type UploadTeamAvatarPayload = $Call<typeof createUploadTeamAvatar, _UploadTeamAvatarPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddParticipantPayload
  | AddPeopleToTeamPayload
  | AddTeamWithChosenChannelsPayload
  | AddToTeamPayload
  | AddUserToTeamsPayload
  | BadgeAppForTeamsPayload
  | CheckRequestedAccessPayload
  | ClearTeamRequestsPayload
  | CreateChannelPayload
  | CreateNewTeamFromConversationPayload
  | CreateNewTeamPayload
  | DeleteChannelConfirmedPayload
  | DeleteChannelInfoPayload
  | EditMembershipPayload
  | EditTeamDescriptionPayload
  | GetChannelInfoPayload
  | GetChannelsPayload
  | GetDetailsForAllTeamsPayload
  | GetDetailsPayload
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
  | RemoveMemberOrPendingInvitePayload
  | RemoveParticipantPayload
  | SaveChannelMembershipPayload
  | SaveTeamRetentionPolicyPayload
  | SetAddUserToTeamsResultsPayload
  | SetChannelCreationErrorPayload
  | SetEmailInviteErrorPayload
  | SetLoadedPayload
  | SetMemberPublicityPayload
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
  | {type: 'common:resetStore', payload: void}
