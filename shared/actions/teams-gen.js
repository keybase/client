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
export const setMemberPublicity = 'teams:setMemberPublicity'
export const setPublicity = 'teams:setPublicity'
export const setTeamCreationError = 'teams:setTeamCreationError'
export const setTeamCreationPending = 'teams:setTeamCreationPending'
export const setTeamJoinError = 'teams:setTeamJoinError'
export const setTeamJoinSuccess = 'teams:setTeamJoinSuccess'
export const setTeamLoadingInvites = 'teams:setTeamLoadingInvites'
export const setTeamRetentionPolicy = 'teams:setTeamRetentionPolicy'
export const setTeamStoreRetentionPolicy = 'teams:setTeamStoreRetentionPolicy'
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
export const createSetMemberPublicity = (
  payload: $ReadOnly<{|
    teamname: string,
    showcase: boolean,
  |}>
) => ({error: false, payload, type: setMemberPublicity})
export const createSetPublicity = (
  payload: $ReadOnly<{|
    teamname: string,
    settings: Types.PublicitySettings,
  |}>
) => ({error: false, payload, type: setPublicity})
export const createSetTeamCreationError = (payload: $ReadOnly<{|error: string|}>) => ({error: false, payload, type: setTeamCreationError})
export const createSetTeamCreationPending = (payload: $ReadOnly<{|pending: boolean|}>) => ({error: false, payload, type: setTeamCreationPending})
export const createSetTeamJoinError = (payload: $ReadOnly<{|error: string|}>) => ({error: false, payload, type: setTeamJoinError})
export const createSetTeamJoinSuccess = (
  payload: $ReadOnly<{|
    success: boolean,
    teamname: ?string,
  |}>
) => ({error: false, payload, type: setTeamJoinSuccess})
export const createSetTeamLoadingInvites = (
  payload: $ReadOnly<{|
    teamname: string,
    invitees: string,
    loadingInvites: boolean,
  |}>
) => ({error: false, payload, type: setTeamLoadingInvites})
export const createSetTeamStoreRetentionPolicy = (
  payload: $ReadOnly<{|
    teamname: string,
    retentionPolicy: Types.RetentionPolicy,
  |}>
) => ({error: false, payload, type: setTeamStoreRetentionPolicy})
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
export type SetMemberPublicityPayload = More.ReturnType<typeof createSetMemberPublicity>
export type SetPublicityPayload = More.ReturnType<typeof createSetPublicity>
export type SetTeamCreationErrorPayload = More.ReturnType<typeof createSetTeamCreationError>
export type SetTeamCreationPendingPayload = More.ReturnType<typeof createSetTeamCreationPending>
export type SetTeamJoinErrorPayload = More.ReturnType<typeof createSetTeamJoinError>
export type SetTeamJoinSuccessPayload = More.ReturnType<typeof createSetTeamJoinSuccess>
export type SetTeamLoadingInvitesPayload = More.ReturnType<typeof createSetTeamLoadingInvites>
export type SetTeamRetentionPolicyPayload = More.ReturnType<typeof createSetTeamRetentionPolicy>
export type SetTeamStoreRetentionPolicyPayload = More.ReturnType<typeof createSetTeamStoreRetentionPolicy>
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
  | More.ReturnType<typeof createSetMemberPublicity>
  | More.ReturnType<typeof createSetPublicity>
  | More.ReturnType<typeof createSetTeamCreationError>
  | More.ReturnType<typeof createSetTeamCreationPending>
  | More.ReturnType<typeof createSetTeamJoinError>
  | More.ReturnType<typeof createSetTeamJoinSuccess>
  | More.ReturnType<typeof createSetTeamLoadingInvites>
  | More.ReturnType<typeof createSetTeamRetentionPolicy>
  | More.ReturnType<typeof createSetTeamStoreRetentionPolicy>
  | More.ReturnType<typeof createSetupTeamHandlers>
  | More.ReturnType<typeof createUpdateChannelName>
  | More.ReturnType<typeof createUpdateTopic>
  | {type: 'common:resetStore', payload: void}
