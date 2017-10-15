// @flow
import React from 'react'
import BigTeamHeader from './big-team-header/container'
import BigTeamChannel from './big-team-channel/container'
import FilterBigTeamChannel from './filter-big-team-channel/container'
import FilterSmallTeamChannel from './filter-small-team/container'
import SmallTeam from './small-team/container'
import * as Constants from '../../../constants/chat'

type MakeRowOptions = {
  channelname: string,
  conversationIDKey: ?Constants.ConversationIDKey,
  filtered: boolean,
  isActiveRoute: boolean,
  teamname: string,
  type: 'small' | 'bigHeader' | 'bigTeamsLabel' | 'big' | 'divider',
}
const makeRow = (options: MakeRowOptions) => {
  if (options.filtered) {
    switch (options.type) {
      case 'big':
        return (
          <FilterBigTeamChannel
            key={`${options.teamname}:${options.channelname}`}
            conversationIDKey={options.conversationIDKey}
            channelname={options.channelname}
            isActiveRoute={options.isActiveRoute}
            teamname={options.teamname}
          />
        )
      case 'small':
        return (
          <FilterSmallTeamChannel
            key={options.conversationIDKey}
            conversationIDKey={options.conversationIDKey}
            channelname={options.channelname}
            isActiveRoute={options.isActiveRoute}
            teamname={options.teamname}
          />
        )
    }
  } else {
    switch (options.type) {
      case 'bigHeader':
        return (
          <BigTeamHeader
            key={options.teamname}
            teamname={options.teamname}
            isActiveRoute={options.isActiveRoute}
          />
        )
      case 'big':
        return (
          <BigTeamChannel
            key={`${options.teamname}:${options.channelname}`}
            conversationIDKey={options.conversationIDKey}
            channelname={options.channelname}
            isActiveRoute={options.isActiveRoute}
          />
        )
      case 'small':
        return (
          <SmallTeam
            key={options.conversationIDKey}
            conversationIDKey={options.conversationIDKey}
            channelname={options.channelname}
            isActiveRoute={options.isActiveRoute}
            teamname={options.teamname}
          />
        )
    }
  }
  return null
}

export {makeRow}
