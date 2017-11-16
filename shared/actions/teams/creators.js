// @flow
import * as Types from '../../constants/types/teams'
import type {ConversationIDKey} from '../../constants/types/chat'

function createNewTeam(name: string) {
  return {payload: {name}, type: 'teams:createNewTeam'}
}

function createNewTeamFromConversation(conversationIDKey: ConversationIDKey, name: string) {
  return {payload: {conversationIDKey, name}, type: 'teams:createNewTeamFromConversation'}
}

function createChannel(teamname: string, channelname: string, description: ?string) {
  return {payload: {channelname, description, teamname}, type: 'teams:createChannel'}
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

function toggleChannelMembership(teamname: string, channelname: string): Types.ToggleChannelMembership {
  return {payload: {channelname, teamname}, type: 'teams:toggleChannelMembership'}
}

function saveChannelMembership(
  teamname: string,
  channelState: Types.ChannelMembershipState
): Types.SaveChannelMembership {
  return {payload: {channelState, teamname}, type: 'teams:saveChannelMembership'}
}

function addPeopleToTeam(teamname: string, role: string): Types.AddPeopleToTeam {
  return {payload: {role, teamname}, type: 'teams:addPeopleToTeam'}
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
  phoneNumber: string
): Types.InviteToTeamByPhone {
  return {payload: {teamname, role, phoneNumber}, type: 'teams:inviteToTeamByPhone'}
}

function joinTeam(teamname: string): Types.JoinTeam {
  return {payload: {teamname}, type: 'teams:joinTeam'}
}

function leaveTeam(teamname: string): Types.LeaveTeam {
  return {payload: {teamname}, type: 'teams:leaveTeam'}
}

function makeTeamOpen(
  teamname: string,
  convertToOpen: boolean,
  defaultRole: Types.TeamRoleType
): Types.MakeTeamOpen {
  return {payload: {convertToOpen, defaultRole, teamname}, type: 'teams:makeTeamOpen'}
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

function editMembership(name: string, username: string, role: Types.TeamRoleType): Types.EditMembership {
  return {payload: {name, username, role}, type: 'teams:editMembership'}
}

function removeMember(email: string, name: string, username: string): Types.RemoveMemberOrPendingInvite {
  return {payload: {email, name, username}, type: 'teams:removeMemberOrPendingInvite'}
}

function ignoreRequest(name: string, username: string): Types.IgnoreRequest {
  return {payload: {name, username}, type: 'teams:ignoreRequest'}
}

function setPublicityMember(teamname: string, enabled: boolean) {
  return {payload: {enabled, teamname}, type: 'teams:setPublicityMember'}
}

function setPublicityTeam(teamname: string, enabled: boolean) {
  return {payload: {enabled, teamname}, type: 'teams:setPublicityTeam'}
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

function setTeamJoinSuccess(teamJoinSuccess: boolean): Types.SetTeamJoinSuccess {
  return {payload: {teamJoinSuccess}, type: 'teams:setTeamJoinSuccess'}
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

function deleteChannel(conversationIDKey: ConversationIDKey): Types.DeleteChannel {
  return {payload: {conversationIDKey}, type: 'teams:deleteChannel'}
}

function badgeAppForTeams(
  newTeamNames: Array<string>,
  newTeamAccessRequests: Array<string>
): Types.BadgeAppForTeams {
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
  setPublicityMember,
  setPublicityTeam,
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
