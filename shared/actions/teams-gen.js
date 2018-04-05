// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as ChatTypes from '../constants/types/chat2'
import * as Types from '../constants/types/teams'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer
export const addPeopleToTeam = 'teams:addPeopleToTeam'
export const addToTeam = 'teams:addToTeam'
export const badgeAppForTeams = 'teams:badgeAppForTeams'
export const checkRequestedAccess = 'teams:checkRequestedAccess'
export const createChannel = 'teams:createChannel'
export const createNewTeam = 'teams:createNewTeam'
export const createNewTeamFromConversation = 'teams:createNewTeamFromConversation'
export const deleteChannelConfirmed = 'teams:deleteChannelConfirmed'
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
export const saveChannelMembership = 'teams:saveChannelMembership'
export const setChannelCreationError = 'teams:setChannelCreationError'
export const setChannelInfo = 'teams:setChannelInfo'
export const setLoaded = 'teams:setLoaded'
export const setMemberPublicity = 'teams:setMemberPublicity'
export const setNewTeamRequests = 'teams:setNewTeamRequests'
export const setNewTeams = 'teams:setNewTeams'
export const setPublicity = 'teams:setPublicity'
export const setTeamAccessRequestsPending = 'teams:setTeamAccessRequestsPending'
export const setTeamCanPerform = 'teams:setTeamCanPerform'
export const setTeamConvIDs = 'teams:setTeamConvIDs'
export const setTeamCreationError = 'teams:setTeamCreationError'
export const setTeamCreationPending = 'teams:setTeamCreationPending'
export const setTeamInfo = 'teams:setTeamInfo'
export const setTeamInvites = 'teams:setTeamInvites'
export const setTeamJoinError = 'teams:setTeamJoinError'
export const setTeamJoinSuccess = 'teams:setTeamJoinSuccess'
export const setTeamLoadingInvites = 'teams:setTeamLoadingInvites'
export const setTeamMemberUsernames = 'teams:setTeamMemberUsernames'
export const setTeamMembers = 'teams:setTeamMembers'
export const setTeamPublicitySettings = 'teams:setTeamPublicitySettings'
export const setTeamRequests = 'teams:setTeamRequests'
export const setTeamResetUsers = 'teams:setTeamResetUsers'
export const setTeamRetentionPolicy = 'teams:setTeamRetentionPolicy'
export const setTeamSawChatBanner = 'teams:setTeamSawChatBanner'
export const setTeamSawSubteamsBanner = 'teams:setTeamSawSubteamsBanner'
export const setTeamSettings = 'teams:setTeamSettings'
export const setTeamStoreRetentionPolicy = 'teams:setTeamStoreRetentionPolicy'
export const setTeamSubteams = 'teams:setTeamSubteams'
export const setupTeamHandlers = 'teams:setupTeamHandlers'
export const updateChannelName = 'teams:updateChannelName'
export const updateTopic = 'teams:updateTopic'

// Action Creators
/**
 * Gets the team retention policy and stores in `state.entities.teams.teamNameToRetentionPolicy`.
 */
export const createGetTeamRetentionPolicy = (payload: $ReadOnly<{|teamname: string|}>) => ({error: false, payload, type: getTeamRetentionPolicy})
/**
 * Sets the retention policy for a team. The store will be updated automatically.
 */
export const createSetTeamRetentionPolicy = (
  payload: $ReadOnly<{|
    teamname: string,
    policy: Types.RetentionPolicy,
  |}>
) => ({error: false, payload, type: setTeamRetentionPolicy})
export const createAddPeopleToTeam = (
  payload: $ReadOnly<{|
    teamname: string,
    role: string,
    sendChatNotification: boolean,
  |}>
) => ({error: false, payload, type: addPeopleToTeam})
export const createAddToTeam = (
  payload: $ReadOnly<{|
    teamname: string,
    email: string,
    username: string,
    role: Types.TeamRoleType,
    sendChatNotification: boolean,
  |}>
) => ({error: false, payload, type: addToTeam})
export const createBadgeAppForTeams = (
  payload: $ReadOnly<{|
    newTeamNames: Array<string>,
    newTeamAccessRequests: Array<string>,
    teamsWithResetUsers: Array<$ReadOnly<{id: Buffer, teamname: string, username: string}>>,
  |}>
) => ({error: false, payload, type: badgeAppForTeams})
export const createCheckRequestedAccess = (payload: $ReadOnly<{|teamname: string|}>) => ({error: false, payload, type: checkRequestedAccess})
export const createCreateChannel = (
  payload: $ReadOnly<{|
    teamname: string,
    channelname: string,
    description: ?string,
    rootPath: I.List<string>,
    sourceSubPath: I.List<string>,
    destSubPath: I.List<string>,
  |}>
) => ({error: false, payload, type: createChannel})
export const createCreateNewTeam = (
  payload: $ReadOnly<{|
    joinSubteam: boolean,
    teamname: string,
    rootPath: I.List<string>,
    sourceSubPath: I.List<string>,
    destSubPath: I.List<string>,
  |}>
) => ({error: false, payload, type: createNewTeam})
export const createCreateNewTeamFromConversation = (
  payload: $ReadOnly<{|
    conversationIDKey: ChatTypes.ConversationIDKey,
    teamname: string,
  |}>
) => ({error: false, payload, type: createNewTeamFromConversation})
export const createDeleteChannelConfirmed = (payload: $ReadOnly<{|conversationIDKey: ChatTypes.ConversationIDKey|}>) => ({error: false, payload, type: deleteChannelConfirmed})
export const createEditMembership = (
  payload: $ReadOnly<{|
    teamname: string,
    username: string,
    role: Types.TeamRoleType,
  |}>
) => ({error: false, payload, type: editMembership})
export const createEditTeamDescription = (
  payload: $ReadOnly<{|
    teamname: string,
    description: string,
  |}>
) => ({error: false, payload, type: editTeamDescription})
export const createGetChannels = (payload: $ReadOnly<{|teamname: string|}>) => ({error: false, payload, type: getChannels})
export const createGetDetails = (payload: $ReadOnly<{|teamname: string|}>) => ({error: false, payload, type: getDetails})
export const createGetTeamOperations = (payload: $ReadOnly<{|teamname: string|}>) => ({error: false, payload, type: getTeamOperations})
export const createGetTeamPublicity = (payload: $ReadOnly<{|teamname: string|}>) => ({error: false, payload, type: getTeamPublicity})
export const createGetTeams = () => ({error: false, payload: undefined, type: getTeams})
export const createIgnoreRequest = (
  payload: $ReadOnly<{|
    teamname: string,
    username: string,
  |}>
) => ({error: false, payload, type: ignoreRequest})
export const createInviteToTeamByEmail = (
  payload: $ReadOnly<{|
    teamname: string,
    role: Types.TeamRoleType,
    invitees: string,
  |}>
) => ({error: false, payload, type: inviteToTeamByEmail})
export const createInviteToTeamByPhone = (
  payload: $ReadOnly<{|
    teamname: string,
    role: Types.TeamRoleType,
    phoneNumber: string,
    fullName: string,
  |}>
) => ({error: false, payload, type: inviteToTeamByPhone})
export const createJoinTeam = (payload: $ReadOnly<{|teamname: string|}>) => ({error: false, payload, type: joinTeam})
export const createLeaveTeam = (payload: $ReadOnly<{|teamname: string|}>) => ({error: false, payload, type: leaveTeam})
export const createRemoveMemberOrPendingInvite = (
  payload: $ReadOnly<{|
    email: string,
    teamname: string,
    username: string,
    inviteID: string,
  |}>
) => ({error: false, payload, type: removeMemberOrPendingInvite})
export const createSaveChannelMembership = (
  payload: $ReadOnly<{|
    teamname: string,
    channelState: Types.ChannelMembershipState,
  |}>
) => ({error: false, payload, type: saveChannelMembership})
export const createSetChannelCreationError = (payload: $ReadOnly<{|error: string|}>) => ({error: false, payload, type: setChannelCreationError})
export const createSetChannelInfo = (payload: $ReadOnly<{|convIDToChannelInfo: {[string]: Types.ChannelInfo}|}>) => ({error: false, payload, type: setChannelInfo})
export const createSetLoaded = (payload: $ReadOnly<{|loaded: boolean|}>) => ({error: false, payload, type: setLoaded})
export const createSetMemberPublicity = (
  payload: $ReadOnly<{|
    teamname: string,
    showcase: boolean,
  |}>
) => ({error: false, payload, type: setMemberPublicity})
export const createSetNewTeamRequests = (payload: $ReadOnly<{|newTeamRequests: I.List<string>|}>) => ({error: false, payload, type: setNewTeamRequests})
export const createSetNewTeams = (payload: $ReadOnly<{|newTeams: I.Set<string>|}>) => ({error: false, payload, type: setNewTeams})
export const createSetPublicity = (
  payload: $ReadOnly<{|
    teamname: string,
    settings: Types.PublicitySettings,
  |}>
) => ({error: false, payload, type: setPublicity})
export const createSetTeamAccessRequestsPending = (payload: $ReadOnly<{|accessRequestsPending: Types.Teamname[]|}>) => ({error: false, payload, type: setTeamAccessRequestsPending})
export const createSetTeamCanPerform = (
  payload: $ReadOnly<{|
    teamname: string,
    teamOperation: Types.TeamOperations,
  |}>
) => ({error: false, payload, type: setTeamCanPerform})
export const createSetTeamConvIDs = (
  payload: $ReadOnly<{|
    teamname: string,
    convIDs: ChatTypes.ConversationIDKey[],
  |}>
) => ({error: false, payload, type: setTeamConvIDs})
export const createSetTeamCreationError = (payload: $ReadOnly<{|error: string|}>) => ({error: false, payload, type: setTeamCreationError})
export const createSetTeamCreationPending = (payload: $ReadOnly<{|pending: boolean|}>) => ({error: false, payload, type: setTeamCreationPending})
export const createSetTeamInfo = (
  payload: $ReadOnly<{|
    teamnames: Types.Teamname[],
    teammembercounts: {[Types.Teamname]: number},
    teamNameToIsOpen: {[Types.Teamname]: number},
    teamNameToRole: {[Types.Teamname]: Types.TeamRoleType},
    teamNameToAllowPromote: {[Types.Teamname]: boolean},
    teamNameToIsShowcasing: {[Types.Teamname]: boolean},
    teamNameToID: {[Types.Teamname]: string},
  |}>
) => ({error: false, payload, type: setTeamInfo})
export const createSetTeamInvites = (
  payload: $ReadOnly<{|
    teamname: string,
    invites: Types.InviteInfo[],
  |}>
) => ({error: false, payload, type: setTeamInvites})
export const createSetTeamJoinError = (payload: $ReadOnly<{|error: string|}>) => ({error: false, payload, type: setTeamJoinError})
export const createSetTeamJoinSuccess = (
  payload: $ReadOnly<{|
    success: boolean,
    teamname: string,
  |}>
) => ({error: false, payload, type: setTeamJoinSuccess})
export const createSetTeamLoadingInvites = (
  payload: $ReadOnly<{|
    teamname: string,
    invitees: string,
    loadingInvites: boolean,
  |}>
) => ({error: false, payload, type: setTeamLoadingInvites})
export const createSetTeamMemberUsernames = (
  payload: $ReadOnly<{|
    teamname: string,
    usernames: string[],
  |}>
) => ({error: false, payload, type: setTeamMemberUsernames})
export const createSetTeamMembers = (
  payload: $ReadOnly<{|
    teamname: string,
    members: Types.MemberInfo[],
  |}>
) => ({error: false, payload, type: setTeamMembers})
export const createSetTeamPublicitySettings = (
  payload: $ReadOnly<{|
    teamname: string,
    publicity: Types._PublicitySettings,
  |}>
) => ({error: false, payload, type: setTeamPublicitySettings})
export const createSetTeamRequests = (payload: $ReadOnly<{|requests: {[string]: I.Set<Types.RequestInfo>}|}>) => ({error: false, payload, type: setTeamRequests})
export const createSetTeamResetUsers = (payload: $ReadOnly<{|teamNameToResetUsers: {[Types.Teamname]: Types.ResetUser}|}>) => ({error: false, payload, type: setTeamResetUsers})
export const createSetTeamSawChatBanner = () => ({error: false, payload: undefined, type: setTeamSawChatBanner})
export const createSetTeamSawSubteamsBanner = () => ({error: false, payload: undefined, type: setTeamSawSubteamsBanner})
export const createSetTeamSettings = (
  payload: $ReadOnly<{|
    teamname: string,
    settings: Types.TeamSettings,
  |}>
) => ({error: false, payload, type: setTeamSettings})
export const createSetTeamStoreRetentionPolicy = (
  payload: $ReadOnly<{|
    teamname: string,
    retentionPolicy: Types.RetentionPolicy,
  |}>
) => ({error: false, payload, type: setTeamStoreRetentionPolicy})
export const createSetTeamSubteams = (
  payload: $ReadOnly<{|
    teamname: string,
    subteams: Types.Teamname[],
  |}>
) => ({error: false, payload, type: setTeamSubteams})
export const createSetupTeamHandlers = () => ({error: false, payload: undefined, type: setupTeamHandlers})
export const createUpdateChannelName = (
  payload: $ReadOnly<{|
    conversationIDKey: ChatTypes.ConversationIDKey,
    newChannelName: string,
  |}>
) => ({error: false, payload, type: updateChannelName})
export const createUpdateTopic = (
  payload: $ReadOnly<{|
    conversationIDKey: ChatTypes.ConversationIDKey,
    newTopic: string,
  |}>
) => ({error: false, payload, type: updateTopic})

// Action Payloads
export type AddPeopleToTeamPayload = More.ReturnType<typeof createAddPeopleToTeam>
export type AddToTeamPayload = More.ReturnType<typeof createAddToTeam>
export type BadgeAppForTeamsPayload = More.ReturnType<typeof createBadgeAppForTeams>
export type CheckRequestedAccessPayload = More.ReturnType<typeof createCheckRequestedAccess>
export type CreateChannelPayload = More.ReturnType<typeof createCreateChannel>
export type CreateNewTeamFromConversationPayload = More.ReturnType<typeof createCreateNewTeamFromConversation>
export type CreateNewTeamPayload = More.ReturnType<typeof createCreateNewTeam>
export type DeleteChannelConfirmedPayload = More.ReturnType<typeof createDeleteChannelConfirmed>
export type EditMembershipPayload = More.ReturnType<typeof createEditMembership>
export type EditTeamDescriptionPayload = More.ReturnType<typeof createEditTeamDescription>
export type GetChannelsPayload = More.ReturnType<typeof createGetChannels>
export type GetDetailsPayload = More.ReturnType<typeof createGetDetails>
export type GetTeamOperationsPayload = More.ReturnType<typeof createGetTeamOperations>
export type GetTeamPublicityPayload = More.ReturnType<typeof createGetTeamPublicity>
export type GetTeamRetentionPolicyPayload = More.ReturnType<typeof createGetTeamRetentionPolicy>
export type GetTeamsPayload = More.ReturnType<typeof createGetTeams>
export type IgnoreRequestPayload = More.ReturnType<typeof createIgnoreRequest>
export type InviteToTeamByEmailPayload = More.ReturnType<typeof createInviteToTeamByEmail>
export type InviteToTeamByPhonePayload = More.ReturnType<typeof createInviteToTeamByPhone>
export type JoinTeamPayload = More.ReturnType<typeof createJoinTeam>
export type LeaveTeamPayload = More.ReturnType<typeof createLeaveTeam>
export type RemoveMemberOrPendingInvitePayload = More.ReturnType<typeof createRemoveMemberOrPendingInvite>
export type SaveChannelMembershipPayload = More.ReturnType<typeof createSaveChannelMembership>
export type SetChannelCreationErrorPayload = More.ReturnType<typeof createSetChannelCreationError>
export type SetChannelInfoPayload = More.ReturnType<typeof createSetChannelInfo>
export type SetLoadedPayload = More.ReturnType<typeof createSetLoaded>
export type SetMemberPublicityPayload = More.ReturnType<typeof createSetMemberPublicity>
export type SetNewTeamRequestsPayload = More.ReturnType<typeof createSetNewTeamRequests>
export type SetNewTeamsPayload = More.ReturnType<typeof createSetNewTeams>
export type SetPublicityPayload = More.ReturnType<typeof createSetPublicity>
export type SetTeamAccessRequestsPendingPayload = More.ReturnType<typeof createSetTeamAccessRequestsPending>
export type SetTeamCanPerformPayload = More.ReturnType<typeof createSetTeamCanPerform>
export type SetTeamConvIDsPayload = More.ReturnType<typeof createSetTeamConvIDs>
export type SetTeamCreationErrorPayload = More.ReturnType<typeof createSetTeamCreationError>
export type SetTeamCreationPendingPayload = More.ReturnType<typeof createSetTeamCreationPending>
export type SetTeamInfoPayload = More.ReturnType<typeof createSetTeamInfo>
export type SetTeamInvitesPayload = More.ReturnType<typeof createSetTeamInvites>
export type SetTeamJoinErrorPayload = More.ReturnType<typeof createSetTeamJoinError>
export type SetTeamJoinSuccessPayload = More.ReturnType<typeof createSetTeamJoinSuccess>
export type SetTeamLoadingInvitesPayload = More.ReturnType<typeof createSetTeamLoadingInvites>
export type SetTeamMemberUsernamesPayload = More.ReturnType<typeof createSetTeamMemberUsernames>
export type SetTeamMembersPayload = More.ReturnType<typeof createSetTeamMembers>
export type SetTeamPublicitySettingsPayload = More.ReturnType<typeof createSetTeamPublicitySettings>
export type SetTeamRequestsPayload = More.ReturnType<typeof createSetTeamRequests>
export type SetTeamResetUsersPayload = More.ReturnType<typeof createSetTeamResetUsers>
export type SetTeamRetentionPolicyPayload = More.ReturnType<typeof createSetTeamRetentionPolicy>
export type SetTeamSawChatBannerPayload = More.ReturnType<typeof createSetTeamSawChatBanner>
export type SetTeamSawSubteamsBannerPayload = More.ReturnType<typeof createSetTeamSawSubteamsBanner>
export type SetTeamSettingsPayload = More.ReturnType<typeof createSetTeamSettings>
export type SetTeamStoreRetentionPolicyPayload = More.ReturnType<typeof createSetTeamStoreRetentionPolicy>
export type SetTeamSubteamsPayload = More.ReturnType<typeof createSetTeamSubteams>
export type SetupTeamHandlersPayload = More.ReturnType<typeof createSetupTeamHandlers>
export type UpdateChannelNamePayload = More.ReturnType<typeof createUpdateChannelName>
export type UpdateTopicPayload = More.ReturnType<typeof createUpdateTopic>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createAddPeopleToTeam>
  | More.ReturnType<typeof createAddToTeam>
  | More.ReturnType<typeof createBadgeAppForTeams>
  | More.ReturnType<typeof createCheckRequestedAccess>
  | More.ReturnType<typeof createCreateChannel>
  | More.ReturnType<typeof createCreateNewTeam>
  | More.ReturnType<typeof createCreateNewTeamFromConversation>
  | More.ReturnType<typeof createDeleteChannelConfirmed>
  | More.ReturnType<typeof createEditMembership>
  | More.ReturnType<typeof createEditTeamDescription>
  | More.ReturnType<typeof createGetChannels>
  | More.ReturnType<typeof createGetDetails>
  | More.ReturnType<typeof createGetTeamOperations>
  | More.ReturnType<typeof createGetTeamPublicity>
  | More.ReturnType<typeof createGetTeamRetentionPolicy>
  | More.ReturnType<typeof createGetTeams>
  | More.ReturnType<typeof createIgnoreRequest>
  | More.ReturnType<typeof createInviteToTeamByEmail>
  | More.ReturnType<typeof createInviteToTeamByPhone>
  | More.ReturnType<typeof createJoinTeam>
  | More.ReturnType<typeof createLeaveTeam>
  | More.ReturnType<typeof createRemoveMemberOrPendingInvite>
  | More.ReturnType<typeof createSaveChannelMembership>
  | More.ReturnType<typeof createSetChannelCreationError>
  | More.ReturnType<typeof createSetChannelInfo>
  | More.ReturnType<typeof createSetLoaded>
  | More.ReturnType<typeof createSetMemberPublicity>
  | More.ReturnType<typeof createSetNewTeamRequests>
  | More.ReturnType<typeof createSetNewTeams>
  | More.ReturnType<typeof createSetPublicity>
  | More.ReturnType<typeof createSetTeamAccessRequestsPending>
  | More.ReturnType<typeof createSetTeamCanPerform>
  | More.ReturnType<typeof createSetTeamConvIDs>
  | More.ReturnType<typeof createSetTeamCreationError>
  | More.ReturnType<typeof createSetTeamCreationPending>
  | More.ReturnType<typeof createSetTeamInfo>
  | More.ReturnType<typeof createSetTeamInvites>
  | More.ReturnType<typeof createSetTeamJoinError>
  | More.ReturnType<typeof createSetTeamJoinSuccess>
  | More.ReturnType<typeof createSetTeamLoadingInvites>
  | More.ReturnType<typeof createSetTeamMemberUsernames>
  | More.ReturnType<typeof createSetTeamMembers>
  | More.ReturnType<typeof createSetTeamPublicitySettings>
  | More.ReturnType<typeof createSetTeamRequests>
  | More.ReturnType<typeof createSetTeamResetUsers>
  | More.ReturnType<typeof createSetTeamRetentionPolicy>
  | More.ReturnType<typeof createSetTeamSawChatBanner>
  | More.ReturnType<typeof createSetTeamSawSubteamsBanner>
  | More.ReturnType<typeof createSetTeamSettings>
  | More.ReturnType<typeof createSetTeamStoreRetentionPolicy>
  | More.ReturnType<typeof createSetTeamSubteams>
  | More.ReturnType<typeof createSetupTeamHandlers>
  | More.ReturnType<typeof createUpdateChannelName>
  | More.ReturnType<typeof createUpdateTopic>
  | {type: 'common:resetStore', payload: void}
