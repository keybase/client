// @flow
import * as Types from '../../constants/types/teams'
import type {ConversationIDKey} from '../../constants/types/chat'
import * as I from 'immutable'

function createNewTeam(
  name: string,
  rootPath: I.List<string>,
  sourceSubPath: I.List<string>,
  destSubPath: I.List<string>
) {
  return {payload: {name, rootPath, sourceSubPath, destSubPath}, type: 'teams:createNewTeam'}
}

function createNewTeamFromConversation(conversationIDKey: ConversationIDKey, name: string) {
  return {payload: {conversationIDKey, name}, type: 'teams:createNewTeamFromConversation'}
}

function createChannel(
  teamname: string,
  channelname: string,
  description: ?string,
  rootPath: I.List<string>,
  sourceSubPath: I.List<string>,
  destSubPath: I.List<string>
) {
  return {
    payload: {channelname, description, teamname, rootPath, sourceSubPath, destSubPath},
    type: 'teams:createChannel',
  }
}

function getChannels(teamname: string): Types.GetChannels {
  return {payload: {teamname}, type: 'teams:getChannels'}
}

function getTeams(): Types.GetTeams {
  return {payload: {}, type: 'teams:getTeams'}
}

function getDetails(teamname: string): Types.GetDetails {
  return {payload: {teamname}, type: 'teams:getDetails'}
}

function saveChannelMembership(
  teamname: string,
  channelState: Types.ChannelMembershipState
): Types.SaveChannelMembership {
  return {payload: {channelState, teamname}, type: 'teams:saveChannelMembership'}
}

function addPeopleToTeam(
  teamname: string,
  role: string,
  sendChatNotification: boolean
): Types.AddPeopleToTeam {
  return {payload: {role, teamname, sendChatNotification}, type: 'teams:addPeopleToTeam'}
}

function inviteToTeamByEmail(
  teamname: string,
  role: Types.TeamRoleType,
  invitees: string
): Types.InviteToTeamByEmail {
  return {payload: {invitees, role, teamname}, type: 'teams:inviteToTeamByEmail'}
}

function inviteToTeamByPhone(
  teamname: string,
  role: Types.TeamRoleType,
  phoneNumber: string,
  fullName: string
): Types.InviteToTeamByPhone {
  return {payload: {teamname, role, phoneNumber, fullName}, type: 'teams:inviteToTeamByPhone'}
}

function joinTeam(teamname: string): Types.JoinTeam {
  return {payload: {teamname}, type: 'teams:joinTeam'}
}

function leaveTeam(teamname: string): Types.LeaveTeam {
  return {payload: {teamname}, type: 'teams:leaveTeam'}
}

function addToTeam(
  name: string,
  email: string,
  username: string,
  role: Types.TeamRoleType,
  sendChatNotification: boolean
): Types.AddToTeam {
  return {payload: {name, email, username, role, sendChatNotification}, type: 'teams:addToTeam'}
}

function editTeamDescription(name: string, description: string): Types.EditDescription {
  return {payload: {description, name}, type: 'teams:editDescription'}
}

function editMembership(name: string, username: string, role: Types.TeamRoleType): Types.EditMembership {
  return {payload: {name, username, role}, type: 'teams:editMembership'}
}

function removeMember(
  email: string,
  name: string,
  username: string,
  inviteID: string
): Types.RemoveMemberOrPendingInvite {
  return {payload: {email, name, username, inviteID}, type: 'teams:removeMemberOrPendingInvite'}
}

function ignoreRequest(name: string, username: string): Types.IgnoreRequest {
  return {payload: {name, username}, type: 'teams:ignoreRequest'}
}

function setPublicity(teamname: string, settings: Types.PublicitySettings) {
  return {payload: {settings, teamname}, type: 'teams:setPublicity'}
}

function setChannelCreationError(channelCreationError: string): Types.SetChannelCreationError {
  return {payload: {channelCreationError}, type: 'teams:setChannelCreationError'}
}

function setTeamCreationError(teamCreationError: string): Types.SetTeamCreationError {
  return {payload: {teamCreationError}, type: 'teams:setTeamCreationError'}
}

function setTeamCreationPending(teamCreationPending: boolean): Types.SetTeamCreationPending {
  return {payload: {teamCreationPending}, type: 'teams:setTeamCreationPending'}
}
function setTeamJoinError(teamJoinError: string): Types.SetTeamJoinError {
  return {payload: {teamJoinError}, type: 'teams:setTeamJoinError'}
}

function setTeamJoinSuccess(teamJoinSuccess: boolean, teamname: ?string): Types.SetTeamJoinSuccess {
  return {payload: {teamJoinSuccess, teamname}, type: 'teams:setTeamJoinSuccess'}
}

function setupTeamHandlers(): Types.SetupTeamHandlers {
  return {payload: undefined, type: 'teams:setupTeamHandlers'}
}

function updateChannelName(
  conversationIDKey: ConversationIDKey,
  newChannelName: string
): Types.UpdateChannelName {
  return {payload: {conversationIDKey, newChannelName}, type: 'teams:updateChannelName'}
}

function updateTopic(conversationIDKey: ConversationIDKey, newTopic: string): Types.UpdateTopic {
  return {payload: {conversationIDKey, newTopic}, type: 'teams:updateTopic'}
}

function deleteChannelConfirmed(conversationIDKey: ConversationIDKey): Types.DeleteChannelConfirmed {
  return {payload: {conversationIDKey}, type: 'teams:deleteChannelConfirmed'}
}

function badgeAppForTeams(
  newTeamNames: Array<string>,
  newTeamAccessRequests: Array<string>
): Types.BadgeAppForTeams {
  return {payload: {newTeamNames, newTeamAccessRequests}, type: 'teams:badgeAppForTeams'}
}

function checkRequestedAccess(teamname: string): Types.CheckRequestedAccess {
  return {payload: {teamname}, type: 'teams:checkRequestedAccess'}
}

export {
  addPeopleToTeam,
  addToTeam,
  checkRequestedAccess,
  createChannel,
  createNewTeam,
  createNewTeamFromConversation,
  deleteChannelConfirmed,
  editMembership,
  editTeamDescription,
  getChannels,
  getDetails,
  getTeams,
  ignoreRequest,
  inviteToTeamByEmail,
  inviteToTeamByPhone,
  joinTeam,
  leaveTeam,
  removeMember,
  saveChannelMembership,
  setChannelCreationError,
  setPublicity,
  setTeamCreationError,
  setTeamCreationPending,
  setTeamJoinError,
  setTeamJoinSuccess,
  setupTeamHandlers,
  updateChannelName,
  updateTopic,
  badgeAppForTeams,
}
