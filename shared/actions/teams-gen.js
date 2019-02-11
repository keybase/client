// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
export type AddParticipantPayload = {|+payload: _AddParticipantPayload, +type: 'teams:addParticipant'|}
export type AddPeopleToTeamPayload = {|+payload: _AddPeopleToTeamPayload, +type: 'teams:addPeopleToTeam'|}
export type AddTeamWithChosenChannelsPayload = {|+payload: _AddTeamWithChosenChannelsPayload, +type: 'teams:addTeamWithChosenChannels'|}
export type AddToTeamPayload = {|+payload: _AddToTeamPayload, +type: 'teams:addToTeam'|}
export type AddUserToTeamsPayload = {|+payload: _AddUserToTeamsPayload, +type: 'teams:addUserToTeams'|}
export type BadgeAppForTeamsPayload = {|+payload: _BadgeAppForTeamsPayload, +type: 'teams:badgeAppForTeams'|}
export type CheckRequestedAccessPayload = {|+payload: _CheckRequestedAccessPayload, +type: 'teams:checkRequestedAccess'|}
export type ClearTeamRequestsPayload = {|+payload: _ClearTeamRequestsPayload, +type: 'teams:clearTeamRequests'|}
export type CreateChannelPayload = {|+payload: _CreateChannelPayload, +type: 'teams:createChannel'|}
export type CreateNewTeamFromConversationPayload = {|+payload: _CreateNewTeamFromConversationPayload, +type: 'teams:createNewTeamFromConversation'|}
export type CreateNewTeamPayload = {|+payload: _CreateNewTeamPayload, +type: 'teams:createNewTeam'|}
export type DeleteChannelConfirmedPayload = {|+payload: _DeleteChannelConfirmedPayload, +type: 'teams:deleteChannelConfirmed'|}
export type DeleteChannelInfoPayload = {|+payload: _DeleteChannelInfoPayload, +type: 'teams:deleteChannelInfo'|}
export type EditMembershipPayload = {|+payload: _EditMembershipPayload, +type: 'teams:editMembership'|}
export type EditTeamDescriptionPayload = {|+payload: _EditTeamDescriptionPayload, +type: 'teams:editTeamDescription'|}
export type GetChannelInfoPayload = {|+payload: _GetChannelInfoPayload, +type: 'teams:getChannelInfo'|}
export type GetChannelsPayload = {|+payload: _GetChannelsPayload, +type: 'teams:getChannels'|}
export type GetDetailsForAllTeamsPayload = {|+payload: _GetDetailsForAllTeamsPayload, +type: 'teams:getDetailsForAllTeams'|}
export type GetDetailsPayload = {|+payload: _GetDetailsPayload, +type: 'teams:getDetails'|}
export type GetTeamOperationsPayload = {|+payload: _GetTeamOperationsPayload, +type: 'teams:getTeamOperations'|}
export type GetTeamProfileAddListPayload = {|+payload: _GetTeamProfileAddListPayload, +type: 'teams:getTeamProfileAddList'|}
export type GetTeamPublicityPayload = {|+payload: _GetTeamPublicityPayload, +type: 'teams:getTeamPublicity'|}
export type GetTeamRetentionPolicyPayload = {|+payload: _GetTeamRetentionPolicyPayload, +type: 'teams:getTeamRetentionPolicy'|}
export type GetTeamsPayload = {|+payload: _GetTeamsPayload, +type: 'teams:getTeams'|}
export type IgnoreRequestPayload = {|+payload: _IgnoreRequestPayload, +type: 'teams:ignoreRequest'|}
export type InviteToTeamByEmailPayload = {|+payload: _InviteToTeamByEmailPayload, +type: 'teams:inviteToTeamByEmail'|}
export type InviteToTeamByPhonePayload = {|+payload: _InviteToTeamByPhonePayload, +type: 'teams:inviteToTeamByPhone'|}
export type JoinTeamPayload = {|+payload: _JoinTeamPayload, +type: 'teams:joinTeam'|}
export type LeaveTeamPayload = {|+payload: _LeaveTeamPayload, +type: 'teams:leaveTeam'|}
export type LeftTeamPayload = {|+payload: _LeftTeamPayload, +type: 'teams:leftTeam'|}
export type RemoveMemberOrPendingInvitePayload = {|+payload: _RemoveMemberOrPendingInvitePayload, +type: 'teams:removeMemberOrPendingInvite'|}
export type RemoveParticipantPayload = {|+payload: _RemoveParticipantPayload, +type: 'teams:removeParticipant'|}
export type SaveChannelMembershipPayload = {|+payload: _SaveChannelMembershipPayload, +type: 'teams:saveChannelMembership'|}
export type SaveTeamRetentionPolicyPayload = {|+payload: _SaveTeamRetentionPolicyPayload, +type: 'teams:saveTeamRetentionPolicy'|}
export type SetAddUserToTeamsResultsPayload = {|+payload: _SetAddUserToTeamsResultsPayload, +type: 'teams:setAddUserToTeamsResults'|}
export type SetChannelCreationErrorPayload = {|+payload: _SetChannelCreationErrorPayload, +type: 'teams:setChannelCreationError'|}
export type SetEmailInviteErrorPayload = {|+payload: _SetEmailInviteErrorPayload, +type: 'teams:setEmailInviteError'|}
export type SetMemberPublicityPayload = {|+payload: _SetMemberPublicityPayload, +type: 'teams:setMemberPublicity'|}
export type SetNewTeamInfoPayload = {|+payload: _SetNewTeamInfoPayload, +type: 'teams:setNewTeamInfo'|}
export type SetPublicityPayload = {|+payload: _SetPublicityPayload, +type: 'teams:setPublicity'|}
export type SetTeamAccessRequestsPendingPayload = {|+payload: _SetTeamAccessRequestsPendingPayload, +type: 'teams:setTeamAccessRequestsPending'|}
export type SetTeamCanPerformPayload = {|+payload: _SetTeamCanPerformPayload, +type: 'teams:setTeamCanPerform'|}
export type SetTeamChannelInfoPayload = {|+payload: _SetTeamChannelInfoPayload, +type: 'teams:setTeamChannelInfo'|}
export type SetTeamChannelsPayload = {|+payload: _SetTeamChannelsPayload, +type: 'teams:setTeamChannels'|}
export type SetTeamCreationErrorPayload = {|+payload: _SetTeamCreationErrorPayload, +type: 'teams:setTeamCreationError'|}
export type SetTeamDetailsPayload = {|+payload: _SetTeamDetailsPayload, +type: 'teams:setTeamDetails'|}
export type SetTeamInfoPayload = {|+payload: _SetTeamInfoPayload, +type: 'teams:setTeamInfo'|}
export type SetTeamInviteErrorPayload = {|+payload: _SetTeamInviteErrorPayload, +type: 'teams:setTeamInviteError'|}
export type SetTeamJoinErrorPayload = {|+payload: _SetTeamJoinErrorPayload, +type: 'teams:setTeamJoinError'|}
export type SetTeamJoinSuccessPayload = {|+payload: _SetTeamJoinSuccessPayload, +type: 'teams:setTeamJoinSuccess'|}
export type SetTeamLoadingInvitesPayload = {|+payload: _SetTeamLoadingInvitesPayload, +type: 'teams:setTeamLoadingInvites'|}
export type SetTeamProfileAddListPayload = {|+payload: _SetTeamProfileAddListPayload, +type: 'teams:setTeamProfileAddList'|}
export type SetTeamPublicitySettingsPayload = {|+payload: _SetTeamPublicitySettingsPayload, +type: 'teams:setTeamPublicitySettings'|}
export type SetTeamRetentionPolicyPayload = {|+payload: _SetTeamRetentionPolicyPayload, +type: 'teams:setTeamRetentionPolicy'|}
export type SetTeamSawChatBannerPayload = {|+payload: _SetTeamSawChatBannerPayload, +type: 'teams:setTeamSawChatBanner'|}
export type SetTeamSawSubteamsBannerPayload = {|+payload: _SetTeamSawSubteamsBannerPayload, +type: 'teams:setTeamSawSubteamsBanner'|}
export type SetTeamsWithChosenChannelsPayload = {|+payload: _SetTeamsWithChosenChannelsPayload, +type: 'teams:setTeamsWithChosenChannels'|}
export type SetUpdatedChannelNamePayload = {|+payload: _SetUpdatedChannelNamePayload, +type: 'teams:setUpdatedChannelName'|}
export type SetUpdatedTopicPayload = {|+payload: _SetUpdatedTopicPayload, +type: 'teams:setUpdatedTopic'|}
export type UpdateChannelNamePayload = {|+payload: _UpdateChannelNamePayload, +type: 'teams:updateChannelName'|}
export type UpdateTopicPayload = {|+payload: _UpdateTopicPayload, +type: 'teams:updateTopic'|}
export type UploadTeamAvatarPayload = {|+payload: _UploadTeamAvatarPayload, +type: 'teams:uploadTeamAvatar'|}

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
  | {type: 'common:resetStore', payload: null}
