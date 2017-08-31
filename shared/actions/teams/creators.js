// @flow
import * as Constants from '../../constants/teams'

function getChannels(teamname: string): Constants.GetChannels {
  return {payload: {teamname}, type: 'teams:getChannels'}
}

function toggleChannelMembership(teamname: string, channelname: string): Constants.ToggleChannelMembership {
  return {payload: {teamname, channelname}, type: 'teams:toggleChannelMembership'}
}

export {getChannels, toggleChannelMembership}
