// @flow
import * as Constants from '../../constants/teams'
import type {ConversationIDKey} from '../../constants/chat'

function createNewTeam(name: string) {
  return {payload: {name}, type: 'chat:createNewTeam'}
}

function createNewTeamFromConversation(conversationIDKey: ConversationIDKey, name: string) {
  return {payload: {conversationIDKey, name}, type: 'chat:createNewTeamFromConversation'}
}

function getChannels(teamname: string): Constants.GetChannels {
  return {payload: {teamname}, type: 'teams:getChannels'}
}

function getTeams(): Constants.GetTeams {
  return {payload: {}, type: 'teams:getTeams'}
}

function toggleChannelMembership(teamname: string, channelname: string): Constants.ToggleChannelMembership {
  return {payload: {channelname, teamname}, type: 'teams:toggleChannelMembership'}
}

export {createNewTeam, createNewTeamFromConversation, getChannels, getTeams, toggleChannelMembership}
