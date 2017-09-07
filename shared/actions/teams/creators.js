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

function leaveTeam(teamname: string): Constants.LeaveTeam {
  return {payload: {teamname}, type: 'teams:leaveTeam'}
}

function setupTeamHandlers(): Constants.SetupTeamHandlers {
  return {payload: undefined, type: 'teams:setupTeamHandlers'}
}

export {
  createChannel,
  createNewTeam,
  createNewTeamFromConversation,
  getChannels,
  getDetails,
  getTeams,
  leaveTeam,
  setupTeamHandlers,
  toggleChannelMembership,
}
