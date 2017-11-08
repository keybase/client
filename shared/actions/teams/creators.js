// @flow
import * as Constants from '../../constants/teams'
import type {ConversationIDKey} from '../../constants/chat'

function createNewTeam(name: string) {
  return {payload: {name}, type: 'teams:createNewTeam'}
}

function createNewTeamFromConversation(conversationIDKey: ConversationIDKey, name: string) {
  return {payload: {conversationIDKey, name}, type: 'teams:createNewTeamFromConversation'}
}

function createChannel(teamname: string, channelname: string, description: ?string) {
  return {payload: {channelname, description, teamname}, type: 'teams:createChannel'}
}

function getChannels(teamname: string): Constants.GetChannels {
  return {payload: {teamname}, type: 'teams:getChannels'}
}

function getTeams(): Constants.GetTeams {
  return {payload: {}, type: 'teams:getTeams'}
}

function getDetails(teamname: string): Constants.GetDetails {
  return {payload: {teamname}, type: 'teams:getDetails'}
}

function toggleChannelMembership(teamname: string, channelname: string): Constants.ToggleChannelMembership {
  return {payload: {channelname, teamname}, type: 'teams:toggleChannelMembership'}
}

function saveChannelMembership(
  teamname: string,
  channelState: Constants.ChannelMembershipState
): Constants.SaveChannelMembership {
  return {payload: {channelState, teamname}, type: 'teams:saveChannelMembership'}
}

function addPeopleToTeam(teamname: string, role: string): Constants.AddPeopleToTeam {
  return {payload: {role, teamname}, type: 'teams:addPeopleToTeam'}
}

function inviteToTeamByEmail(
  teamname: string,
  role: Constants.TeamRoleType,
  invitees: string
): Constants.InviteToTeamByEmail {
  return {payload: {invitees, role, teamname}, type: 'teams:inviteToTeamByEmail'}
}

function inviteToTeamByPhone(
  teamname: string,
  role: Constants.TeamRoleType,
  phoneNumber: string
): Constants.InviteToTeamByPhone {
  return {payload: {teamname, role, phoneNumber}, type: 'teams:inviteToTeamByPhone'}
}

function joinTeam(teamname: string): Constants.JoinTeam {
  return {payload: {teamname}, type: 'teams:joinTeam'}
}

function leaveTeam(teamname: string): Constants.LeaveTeam {
  return {payload: {teamname}, type: 'teams:leaveTeam'}
}

function makeTeamOpen(
  teamname: string,
  convertToOpen: boolean,
  defaultRole: Constants.TeamRoleType
): Constants.MakeTeamOpen {
  return {payload: {convertToOpen, defaultRole, teamname}, type: 'teams:makeTeamOpen'}
}

function addToTeam(
  name: string,
  email: string,
  username: string,
  role: Constants.TeamRoleType,
  sendChatNotification: boolean
): Constants.AddToTeam {
  return {payload: {name, email, username, role, sendChatNotification}, type: 'teams:addToTeam'}
}

function editMembership(
  name: string,
  username: string,
  role: Constants.TeamRoleType
): Constants.EditMembership {
  return {payload: {name, username, role}, type: 'teams:editMembership'}
}

function removeMember(email: string, name: string, username: string): Constants.RemoveMemberOrPendingInvite {
  return {payload: {email, name, username}, type: 'teams:removeMemberOrPendingInvite'}
}

function ignoreRequest(name: string, username: string): Constants.IgnoreRequest {
  return {payload: {name, username}, type: 'teams:ignoreRequest'}
}

function setTeamCreationError(teamCreationError: string): Constants.SetTeamCreationError {
  return {payload: {teamCreationError}, type: 'teams:setTeamCreationError'}
}

function setTeamCreationPending(teamCreationPending: boolean): Constants.SetTeamCreationPending {
  return {payload: {teamCreationPending}, type: 'teams:setTeamCreationPending'}
}
function setTeamJoinError(teamJoinError: string): Constants.SetTeamJoinError {
  return {payload: {teamJoinError}, type: 'teams:setTeamJoinError'}
}

function setTeamJoinSuccess(teamJoinSuccess: boolean): Constants.SetTeamJoinSuccess {
  return {payload: {teamJoinSuccess}, type: 'teams:setTeamJoinSuccess'}
}

function setupTeamHandlers(): Constants.SetupTeamHandlers {
  return {payload: undefined, type: 'teams:setupTeamHandlers'}
}

function updateChannelName(
  conversationIDKey: ConversationIDKey,
  newChannelName: string
): Constants.UpdateChannelName {
  return {payload: {conversationIDKey, newChannelName}, type: 'teams:updateChannelName'}
}

function updateTopic(conversationIDKey: ConversationIDKey, newTopic: string): Constants.UpdateTopic {
  return {payload: {conversationIDKey, newTopic}, type: 'teams:updateTopic'}
}

function deleteChannel(conversationIDKey: ConversationIDKey): Constants.DeleteChannel {
  return {payload: {conversationIDKey}, type: 'teams:deleteChannel'}
}

function badgeAppForTeams(
  newTeamNames: Array<string>,
  newTeamAccessRequests: Array<string>
): Constants.BadgeAppForTeams {
  return {payload: {newTeamNames, newTeamAccessRequests}, type: 'teams:badgeAppForTeams'}
}

export {
  addPeopleToTeam,
  addToTeam,
  createChannel,
  createNewTeam,
  createNewTeamFromConversation,
  deleteChannel,
  editMembership,
  getChannels,
  getDetails,
  getTeams,
  ignoreRequest,
  inviteToTeamByEmail,
  inviteToTeamByPhone,
  joinTeam,
  leaveTeam,
  makeTeamOpen,
  removeMember,
  saveChannelMembership,
  setTeamCreationError,
  setTeamCreationPending,
  setTeamJoinError,
  setTeamJoinSuccess,
  setupTeamHandlers,
  toggleChannelMembership,
  updateChannelName,
  updateTopic,
  badgeAppForTeams,
}
