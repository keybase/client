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

function addPeopleToTeam(teamname: string, role: string): Constants.AddPeopleToTeam {
  return {payload: {role, teamname}, type: 'teams:addPeopleToTeam'}
}

function joinTeam(teamname: string): Constants.JoinTeam {
  return {payload: {teamname}, type: 'teams:joinTeam'}
}

function leaveTeam(teamname: string): Constants.LeaveTeam {
  return {payload: {teamname}, type: 'teams:leaveTeam'}
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

function removeMember(name: string, username: string): Constants.RemoveMemberOrPendingInvite {
  return {payload: {name, username, email: ''}, type: 'teams:removeMemberOrPendingInvite'}
}

function removePendingInvite(name: string, email: string): Constants.RemoveMemberOrPendingInvite {
  return {payload: {name, email, username: ''}, type: 'teams:removeMemberOrPendingInvite'}
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

export {
  addPeopleToTeam,
  addToTeam,
  createChannel,
  createNewTeam,
  createNewTeamFromConversation,
  editMembership,
  getChannels,
  getDetails,
  getTeams,
  ignoreRequest,
  joinTeam,
  leaveTeam,
  removeMember,
  removePendingInvite,
  setTeamCreationError,
  setTeamCreationPending,
  setTeamJoinError,
  setTeamJoinSuccess,
  setupTeamHandlers,
  toggleChannelMembership,
}
