// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as ChatTypes from '../constants/types/chat2'
import * as Types from '../constants/types/teams'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer
export const addParticipant = 'teams:addParticipant'
export const addPeopleToTeam = 'teams:addPeopleToTeam'
export const addTeamWithChosenChannels = 'teams:addTeamWithChosenChannels'
export const addToTeam = 'teams:addToTeam'
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
export const getChannels = 'teams:getChannels'
export const getDetails = 'teams:getDetails'
export const getTeamOperations = 'teams:getTeamOperations'
export const getTeamPublicity = 'teams:getTeamPublicity'
export const getTeamRetentionPolicy = 'teams:getTeamRetentionPolicy'
export const getTeams = 'teams:getTeams'
export const ignoreRequest = 'teams:ignoreRequest'
export const inviteToTeamByEmail = 'teams:inviteToTeamByEmail'
export const inviteToTeamByPhone = 'teams:inviteToTeamByPhone'
export const joinTeam = 'teams:joinTeam'
export const leaveTeam = 'teams:leaveTeam'
export const removeMemberOrPendingInvite = 'teams:removeMemberOrPendingInvite'
export const removeParticipant = 'teams:removeParticipant'
export const saveChannelMembership = 'teams:saveChannelMembership'
export const saveTeamRetentionPolicy = 'teams:saveTeamRetentionPolicy'
export const setChannelCreationError = 'teams:setChannelCreationError'
export const setLoaded = 'teams:setLoaded'
export const setMemberPublicity = 'teams:setMemberPublicity'
export const setNewTeamInfo = 'teams:setNewTeamInfo'
export const setPublicity = 'teams:setPublicity'
export const setTeamAccessRequestsPending = 'teams:setTeamAccessRequestsPending'
export const setTeamCanPerform = 'teams:setTeamCanPerform'
export const setTeamChannels = 'teams:setTeamChannels'
export const setTeamCreationError = 'teams:setTeamCreationError'
export const setTeamCreationPending = 'teams:setTeamCreationPending'
export const setTeamDetails = 'teams:setTeamDetails'
export const setTeamInfo = 'teams:setTeamInfo'
export const setTeamInviteError = 'teams:setTeamInviteError'
export const setTeamJoinError = 'teams:setTeamJoinError'
export const setTeamJoinSuccess = 'teams:setTeamJoinSuccess'
export const setTeamLoadingInvites = 'teams:setTeamLoadingInvites'
export const setTeamPublicitySettings = 'teams:setTeamPublicitySettings'
export const setTeamRetentionPolicy = 'teams:setTeamRetentionPolicy'
export const setTeamSawChatBanner = 'teams:setTeamSawChatBanner'
export const setTeamSawSubteamsBanner = 'teams:setTeamSawSubteamsBanner'
export const setTeamsWithChosenChannels = 'teams:setTeamsWithChosenChannels'
export const setUpdatedChannelName = 'teams:setUpdatedChannelName'
export const setUpdatedTopic = 'teams:setUpdatedTopic'
export const setupTeamHandlers = 'teams:setupTeamHandlers'
export const updateChannelName = 'teams:updateChannelName'
export const updateTopic = 'teams:updateTopic'

// Payload Types
type _AddParticipantPayload = $ReadOnly<{|
  teamname: string,
  conversationIDKey: ChatTypes.ConversationIDKey,
  participant: string,
|}>
type _AddPeopleToTeamPayload = $ReadOnly<{|
  destSubPath: I.List<string>,
  role: string,
  rootPath: I.List<string>,
  sendChatNotification: boolean,
  sourceSubPath: I.List<string>,
  teamname: string,
|}>
type _AddTeamWithChosenChannelsPayload = $ReadOnly<{|teamname: string|}>
type _AddToTeamPayload = $ReadOnly<{|
  teamname: string,
  username: string,
  role: Types.TeamRoleType,
  sendChatNotification: boolean,
|}>
type _BadgeAppForTeamsPayload = $ReadOnly<{|
  newTeamNames: Array<string>,
  newTeamAccessRequests: Array<string>,
  teamsWithResetUsers: Array<$ReadOnly<{id: Buffer, teamname: string, username: string}>>,
|}>
type _CheckRequestedAccessPayload = $ReadOnly<{|teamname: string|}>
type _ClearTeamRequestsPayload = $ReadOnly<{|teamname: string|}>
type _CreateChannelPayload = $ReadOnly<{|
  teamname: string,
  channelname: string,
  description: ?string,
  rootPath: I.List<string>,
  sourceSubPath: I.List<string>,
  destSubPath: I.List<string>,
|}>
type _CreateNewTeamFromConversationPayload = $ReadOnly<{|
  conversationIDKey: ChatTypes.ConversationIDKey,
  teamname: string,
|}>
type _CreateNewTeamPayload = $ReadOnly<{|
  joinSubteam: boolean,
  teamname: string,
  rootPath: I.List<string>,
  sourceSubPath: I.List<string>,
  destSubPath: I.List<string>,
|}>
type _DeleteChannelConfirmedPayload = $ReadOnly<{|
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
|}>
type _DeleteChannelInfoPayload = $ReadOnly<{|
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
|}>
type _EditMembershipPayload = $ReadOnly<{|
  teamname: string,
  username: string,
  role: Types.TeamRoleType,
|}>
type _EditTeamDescriptionPayload = $ReadOnly<{|
  teamname: string,
  description: string,
|}>
type _GetChannelsPayload = $ReadOnly<{|teamname: string|}>
type _GetDetailsPayload = $ReadOnly<{|teamname: string|}>
type _GetTeamOperationsPayload = $ReadOnly<{|teamname: string|}>
type _GetTeamPublicityPayload = $ReadOnly<{|teamname: string|}>
type _GetTeamRetentionPolicyPayload = $ReadOnly<{|teamname: string|}>
type _GetTeamsPayload = void
type _IgnoreRequestPayload = $ReadOnly<{|
  teamname: string,
  username: string,
|}>
type _InviteToTeamByEmailPayload = $ReadOnly<{|
  teamname: string,
  role: Types.TeamRoleType,
  invitees: string,
|}>
type _InviteToTeamByPhonePayload = $ReadOnly<{|
  teamname: string,
  role: Types.TeamRoleType,
  phoneNumber: string,
  fullName: string,
|}>
type _JoinTeamPayload = $ReadOnly<{|teamname: string|}>
type _LeaveTeamPayload = $ReadOnly<{|teamname: string|}>
type _RemoveMemberOrPendingInvitePayload = $ReadOnly<{|
  email: string,
  teamname: string,
  username: string,
  inviteID: string,
|}>
type _RemoveParticipantPayload = $ReadOnly<{|
  teamname: string,
  conversationIDKey: ChatTypes.ConversationIDKey,
  participant: string,
|}>
type _SaveChannelMembershipPayload = $ReadOnly<{|
  teamname: string,
  oldChannelState: Types.ChannelMembershipState,
  newChannelState: Types.ChannelMembershipState,
  you: string,
|}>
type _SaveTeamRetentionPolicyPayload = $ReadOnly<{|
  teamname: string,
  policy: Types.RetentionPolicy,
|}>
type _SetChannelCreationErrorPayload = $ReadOnly<{|error: string|}>
type _SetLoadedPayload = $ReadOnly<{|loaded: boolean|}>
type _SetMemberPublicityPayload = $ReadOnly<{|
  teamname: string,
  showcase: boolean,
|}>
type _SetNewTeamInfoPayload = $ReadOnly<{|
  newTeams: I.Set<string>,
  newTeamRequests: I.List<string>,
  teamNameToResetUsers: I.Map<Types.Teamname, I.Set<Types.ResetUser>>,
|}>
type _SetPublicityPayload = $ReadOnly<{|
  teamname: string,
  settings: Types.PublicitySettings,
|}>
type _SetTeamAccessRequestsPendingPayload = $ReadOnly<{|accessRequestsPending: I.Set<Types.Teamname>|}>
type _SetTeamCanPerformPayload = $ReadOnly<{|
  teamname: string,
  teamOperation: Types.TeamOperations,
|}>
type _SetTeamChannelsPayload = $ReadOnly<{|
  teamname: string,
  channelInfos: I.Map<ChatTypes.ConversationIDKey, Types.ChannelInfo>,
|}>
type _SetTeamCreationErrorPayload = $ReadOnly<{|error: string|}>
type _SetTeamCreationPendingPayload = $ReadOnly<{|pending: boolean|}>
type _SetTeamDetailsPayload = $ReadOnly<{|
  teamname: string,
  members: I.Map<string, Types.MemberInfo>,
  settings: Types.TeamSettings,
  invites: I.Set<Types.InviteInfo>,
  subteams: I.Set<Types.Teamname>,
  requests: I.Map<string, I.Set<Types.RequestInfo>>,
|}>
type _SetTeamInfoPayload = $ReadOnly<{|
  teamnames: I.Set<Types.Teamname>,
  teammembercounts: I.Map<Types.Teamname, number>,
  teamNameToIsOpen: I.Map<Types.Teamname, boolean>,
  teamNameToRole: I.Map<Types.Teamname, Types.MaybeTeamRoleType>,
  teamNameToAllowPromote: I.Map<Types.Teamname, boolean>,
  teamNameToIsShowcasing: I.Map<Types.Teamname, boolean>,
  teamNameToID: I.Map<Types.Teamname, string>,
|}>
type _SetTeamInviteErrorPayload = $ReadOnly<{|error: string|}>
type _SetTeamJoinErrorPayload = $ReadOnly<{|error: string|}>
type _SetTeamJoinSuccessPayload = $ReadOnly<{|
  success: boolean,
  teamname: string,
|}>
type _SetTeamLoadingInvitesPayload = $ReadOnly<{|
  teamname: string,
  invitees: string,
  loadingInvites: boolean,
|}>
type _SetTeamPublicitySettingsPayload = $ReadOnly<{|
  teamname: string,
  publicity: Types._PublicitySettings,
|}>
type _SetTeamRetentionPolicyPayload = $ReadOnly<{|
  teamname: string,
  retentionPolicy: Types.RetentionPolicy,
|}>
type _SetTeamSawChatBannerPayload = void
type _SetTeamSawSubteamsBannerPayload = void
type _SetTeamsWithChosenChannelsPayload = $ReadOnly<{|teamsWithChosenChannels: I.Set<Types.Teamname>|}>
type _SetUpdatedChannelNamePayload = $ReadOnly<{|
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  newChannelName: string,
|}>
type _SetUpdatedTopicPayload = $ReadOnly<{|
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  newTopic: string,
|}>
type _SetupTeamHandlersPayload = void
type _UpdateChannelNamePayload = $ReadOnly<{|
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  newChannelName: string,
|}>
type _UpdateTopicPayload = $ReadOnly<{|
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  newTopic: string,
|}>

// Action Creators
/**
 * Fetches the channel information for all channels in a team from the server. Should only be called for components that need the full list.
 */
export const createGetChannels = (payload: _GetChannelsPayload) => ({error: false, payload, type: getChannels})
/**
 * Gets the team retention policy and stores in `state.entities.teams.teamNameToRetentionPolicy`.
 */
export const createGetTeamRetentionPolicy = (payload: _GetTeamRetentionPolicyPayload) => ({error: false, payload, type: getTeamRetentionPolicy})
/**
 * Sets the retention policy for a team. The store will be updated automatically.
 */
export const createSaveTeamRetentionPolicy = (payload: _SaveTeamRetentionPolicyPayload) => ({error: false, payload, type: saveTeamRetentionPolicy})
export const createAddParticipant = (payload: _AddParticipantPayload) => ({error: false, payload, type: addParticipant})
export const createAddPeopleToTeam = (payload: _AddPeopleToTeamPayload) => ({error: false, payload, type: addPeopleToTeam})
export const createAddTeamWithChosenChannels = (payload: _AddTeamWithChosenChannelsPayload) => ({error: false, payload, type: addTeamWithChosenChannels})
export const createAddToTeam = (payload: _AddToTeamPayload) => ({error: false, payload, type: addToTeam})
export const createBadgeAppForTeams = (payload: _BadgeAppForTeamsPayload) => ({error: false, payload, type: badgeAppForTeams})
export const createCheckRequestedAccess = (payload: _CheckRequestedAccessPayload) => ({error: false, payload, type: checkRequestedAccess})
export const createClearTeamRequests = (payload: _ClearTeamRequestsPayload) => ({error: false, payload, type: clearTeamRequests})
export const createCreateChannel = (payload: _CreateChannelPayload) => ({error: false, payload, type: createChannel})
export const createCreateNewTeam = (payload: _CreateNewTeamPayload) => ({error: false, payload, type: createNewTeam})
export const createCreateNewTeamFromConversation = (payload: _CreateNewTeamFromConversationPayload) => ({error: false, payload, type: createNewTeamFromConversation})
export const createDeleteChannelConfirmed = (payload: _DeleteChannelConfirmedPayload) => ({error: false, payload, type: deleteChannelConfirmed})
export const createDeleteChannelInfo = (payload: _DeleteChannelInfoPayload) => ({error: false, payload, type: deleteChannelInfo})
export const createEditMembership = (payload: _EditMembershipPayload) => ({error: false, payload, type: editMembership})
export const createEditTeamDescription = (payload: _EditTeamDescriptionPayload) => ({error: false, payload, type: editTeamDescription})
export const createGetDetails = (payload: _GetDetailsPayload) => ({error: false, payload, type: getDetails})
export const createGetTeamOperations = (payload: _GetTeamOperationsPayload) => ({error: false, payload, type: getTeamOperations})
export const createGetTeamPublicity = (payload: _GetTeamPublicityPayload) => ({error: false, payload, type: getTeamPublicity})
export const createGetTeams = (payload: _GetTeamsPayload) => ({error: false, payload, type: getTeams})
export const createIgnoreRequest = (payload: _IgnoreRequestPayload) => ({error: false, payload, type: ignoreRequest})
export const createInviteToTeamByEmail = (payload: _InviteToTeamByEmailPayload) => ({error: false, payload, type: inviteToTeamByEmail})
export const createInviteToTeamByPhone = (payload: _InviteToTeamByPhonePayload) => ({error: false, payload, type: inviteToTeamByPhone})
export const createJoinTeam = (payload: _JoinTeamPayload) => ({error: false, payload, type: joinTeam})
export const createLeaveTeam = (payload: _LeaveTeamPayload) => ({error: false, payload, type: leaveTeam})
export const createRemoveMemberOrPendingInvite = (payload: _RemoveMemberOrPendingInvitePayload) => ({error: false, payload, type: removeMemberOrPendingInvite})
export const createRemoveParticipant = (payload: _RemoveParticipantPayload) => ({error: false, payload, type: removeParticipant})
export const createSaveChannelMembership = (payload: _SaveChannelMembershipPayload) => ({error: false, payload, type: saveChannelMembership})
export const createSetChannelCreationError = (payload: _SetChannelCreationErrorPayload) => ({error: false, payload, type: setChannelCreationError})
export const createSetLoaded = (payload: _SetLoadedPayload) => ({error: false, payload, type: setLoaded})
export const createSetMemberPublicity = (payload: _SetMemberPublicityPayload) => ({error: false, payload, type: setMemberPublicity})
export const createSetNewTeamInfo = (payload: _SetNewTeamInfoPayload) => ({error: false, payload, type: setNewTeamInfo})
export const createSetPublicity = (payload: _SetPublicityPayload) => ({error: false, payload, type: setPublicity})
export const createSetTeamAccessRequestsPending = (payload: _SetTeamAccessRequestsPendingPayload) => ({error: false, payload, type: setTeamAccessRequestsPending})
export const createSetTeamCanPerform = (payload: _SetTeamCanPerformPayload) => ({error: false, payload, type: setTeamCanPerform})
export const createSetTeamChannels = (payload: _SetTeamChannelsPayload) => ({error: false, payload, type: setTeamChannels})
export const createSetTeamCreationError = (payload: _SetTeamCreationErrorPayload) => ({error: false, payload, type: setTeamCreationError})
export const createSetTeamCreationPending = (payload: _SetTeamCreationPendingPayload) => ({error: false, payload, type: setTeamCreationPending})
export const createSetTeamDetails = (payload: _SetTeamDetailsPayload) => ({error: false, payload, type: setTeamDetails})
export const createSetTeamInfo = (payload: _SetTeamInfoPayload) => ({error: false, payload, type: setTeamInfo})
export const createSetTeamInviteError = (payload: _SetTeamInviteErrorPayload) => ({error: false, payload, type: setTeamInviteError})
export const createSetTeamJoinError = (payload: _SetTeamJoinErrorPayload) => ({error: false, payload, type: setTeamJoinError})
export const createSetTeamJoinSuccess = (payload: _SetTeamJoinSuccessPayload) => ({error: false, payload, type: setTeamJoinSuccess})
export const createSetTeamLoadingInvites = (payload: _SetTeamLoadingInvitesPayload) => ({error: false, payload, type: setTeamLoadingInvites})
export const createSetTeamPublicitySettings = (payload: _SetTeamPublicitySettingsPayload) => ({error: false, payload, type: setTeamPublicitySettings})
export const createSetTeamRetentionPolicy = (payload: _SetTeamRetentionPolicyPayload) => ({error: false, payload, type: setTeamRetentionPolicy})
export const createSetTeamSawChatBanner = (payload: _SetTeamSawChatBannerPayload) => ({error: false, payload, type: setTeamSawChatBanner})
export const createSetTeamSawSubteamsBanner = (payload: _SetTeamSawSubteamsBannerPayload) => ({error: false, payload, type: setTeamSawSubteamsBanner})
export const createSetTeamsWithChosenChannels = (payload: _SetTeamsWithChosenChannelsPayload) => ({error: false, payload, type: setTeamsWithChosenChannels})
export const createSetUpdatedChannelName = (payload: _SetUpdatedChannelNamePayload) => ({error: false, payload, type: setUpdatedChannelName})
export const createSetUpdatedTopic = (payload: _SetUpdatedTopicPayload) => ({error: false, payload, type: setUpdatedTopic})
export const createSetupTeamHandlers = (payload: _SetupTeamHandlersPayload) => ({error: false, payload, type: setupTeamHandlers})
export const createUpdateChannelName = (payload: _UpdateChannelNamePayload) => ({error: false, payload, type: updateChannelName})
export const createUpdateTopic = (payload: _UpdateTopicPayload) => ({error: false, payload, type: updateTopic})

// Action Payloads
export type AddParticipantPayload = $Call<typeof createAddParticipant, _AddParticipantPayload>
export type AddPeopleToTeamPayload = $Call<typeof createAddPeopleToTeam, _AddPeopleToTeamPayload>
export type AddTeamWithChosenChannelsPayload = $Call<typeof createAddTeamWithChosenChannels, _AddTeamWithChosenChannelsPayload>
export type AddToTeamPayload = $Call<typeof createAddToTeam, _AddToTeamPayload>
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
export type GetChannelsPayload = $Call<typeof createGetChannels, _GetChannelsPayload>
export type GetDetailsPayload = $Call<typeof createGetDetails, _GetDetailsPayload>
export type GetTeamOperationsPayload = $Call<typeof createGetTeamOperations, _GetTeamOperationsPayload>
export type GetTeamPublicityPayload = $Call<typeof createGetTeamPublicity, _GetTeamPublicityPayload>
export type GetTeamRetentionPolicyPayload = $Call<typeof createGetTeamRetentionPolicy, _GetTeamRetentionPolicyPayload>
export type GetTeamsPayload = $Call<typeof createGetTeams, _GetTeamsPayload>
export type IgnoreRequestPayload = $Call<typeof createIgnoreRequest, _IgnoreRequestPayload>
export type InviteToTeamByEmailPayload = $Call<typeof createInviteToTeamByEmail, _InviteToTeamByEmailPayload>
export type InviteToTeamByPhonePayload = $Call<typeof createInviteToTeamByPhone, _InviteToTeamByPhonePayload>
export type JoinTeamPayload = $Call<typeof createJoinTeam, _JoinTeamPayload>
export type LeaveTeamPayload = $Call<typeof createLeaveTeam, _LeaveTeamPayload>
export type RemoveMemberOrPendingInvitePayload = $Call<typeof createRemoveMemberOrPendingInvite, _RemoveMemberOrPendingInvitePayload>
export type RemoveParticipantPayload = $Call<typeof createRemoveParticipant, _RemoveParticipantPayload>
export type SaveChannelMembershipPayload = $Call<typeof createSaveChannelMembership, _SaveChannelMembershipPayload>
export type SaveTeamRetentionPolicyPayload = $Call<typeof createSaveTeamRetentionPolicy, _SaveTeamRetentionPolicyPayload>
export type SetChannelCreationErrorPayload = $Call<typeof createSetChannelCreationError, _SetChannelCreationErrorPayload>
export type SetLoadedPayload = $Call<typeof createSetLoaded, _SetLoadedPayload>
export type SetMemberPublicityPayload = $Call<typeof createSetMemberPublicity, _SetMemberPublicityPayload>
export type SetNewTeamInfoPayload = $Call<typeof createSetNewTeamInfo, _SetNewTeamInfoPayload>
export type SetPublicityPayload = $Call<typeof createSetPublicity, _SetPublicityPayload>
export type SetTeamAccessRequestsPendingPayload = $Call<typeof createSetTeamAccessRequestsPending, _SetTeamAccessRequestsPendingPayload>
export type SetTeamCanPerformPayload = $Call<typeof createSetTeamCanPerform, _SetTeamCanPerformPayload>
export type SetTeamChannelsPayload = $Call<typeof createSetTeamChannels, _SetTeamChannelsPayload>
export type SetTeamCreationErrorPayload = $Call<typeof createSetTeamCreationError, _SetTeamCreationErrorPayload>
export type SetTeamCreationPendingPayload = $Call<typeof createSetTeamCreationPending, _SetTeamCreationPendingPayload>
export type SetTeamDetailsPayload = $Call<typeof createSetTeamDetails, _SetTeamDetailsPayload>
export type SetTeamInfoPayload = $Call<typeof createSetTeamInfo, _SetTeamInfoPayload>
export type SetTeamInviteErrorPayload = $Call<typeof createSetTeamInviteError, _SetTeamInviteErrorPayload>
export type SetTeamJoinErrorPayload = $Call<typeof createSetTeamJoinError, _SetTeamJoinErrorPayload>
export type SetTeamJoinSuccessPayload = $Call<typeof createSetTeamJoinSuccess, _SetTeamJoinSuccessPayload>
export type SetTeamLoadingInvitesPayload = $Call<typeof createSetTeamLoadingInvites, _SetTeamLoadingInvitesPayload>
export type SetTeamPublicitySettingsPayload = $Call<typeof createSetTeamPublicitySettings, _SetTeamPublicitySettingsPayload>
export type SetTeamRetentionPolicyPayload = $Call<typeof createSetTeamRetentionPolicy, _SetTeamRetentionPolicyPayload>
export type SetTeamSawChatBannerPayload = $Call<typeof createSetTeamSawChatBanner, _SetTeamSawChatBannerPayload>
export type SetTeamSawSubteamsBannerPayload = $Call<typeof createSetTeamSawSubteamsBanner, _SetTeamSawSubteamsBannerPayload>
export type SetTeamsWithChosenChannelsPayload = $Call<typeof createSetTeamsWithChosenChannels, _SetTeamsWithChosenChannelsPayload>
export type SetUpdatedChannelNamePayload = $Call<typeof createSetUpdatedChannelName, _SetUpdatedChannelNamePayload>
export type SetUpdatedTopicPayload = $Call<typeof createSetUpdatedTopic, _SetUpdatedTopicPayload>
export type SetupTeamHandlersPayload = $Call<typeof createSetupTeamHandlers, _SetupTeamHandlersPayload>
export type UpdateChannelNamePayload = $Call<typeof createUpdateChannelName, _UpdateChannelNamePayload>
export type UpdateTopicPayload = $Call<typeof createUpdateTopic, _UpdateTopicPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddParticipantPayload
  | AddPeopleToTeamPayload
  | AddTeamWithChosenChannelsPayload
  | AddToTeamPayload
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
  | GetChannelsPayload
  | GetDetailsPayload
  | GetTeamOperationsPayload
  | GetTeamPublicityPayload
  | GetTeamRetentionPolicyPayload
  | GetTeamsPayload
  | IgnoreRequestPayload
  | InviteToTeamByEmailPayload
  | InviteToTeamByPhonePayload
  | JoinTeamPayload
  | LeaveTeamPayload
  | RemoveMemberOrPendingInvitePayload
  | RemoveParticipantPayload
  | SaveChannelMembershipPayload
  | SaveTeamRetentionPolicyPayload
  | SetChannelCreationErrorPayload
  | SetLoadedPayload
  | SetMemberPublicityPayload
  | SetNewTeamInfoPayload
  | SetPublicityPayload
  | SetTeamAccessRequestsPendingPayload
  | SetTeamCanPerformPayload
  | SetTeamChannelsPayload
  | SetTeamCreationErrorPayload
  | SetTeamCreationPendingPayload
  | SetTeamDetailsPayload
  | SetTeamInfoPayload
  | SetTeamInviteErrorPayload
  | SetTeamJoinErrorPayload
  | SetTeamJoinSuccessPayload
  | SetTeamLoadingInvitesPayload
  | SetTeamPublicitySettingsPayload
  | SetTeamRetentionPolicyPayload
  | SetTeamSawChatBannerPayload
  | SetTeamSawSubteamsBannerPayload
  | SetTeamsWithChosenChannelsPayload
  | SetUpdatedChannelNamePayload
  | SetUpdatedTopicPayload
  | SetupTeamHandlersPayload
  | UpdateChannelNamePayload
  | UpdateTopicPayload
  | {type: 'common:resetStore', payload: void}
