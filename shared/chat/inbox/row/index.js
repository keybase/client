// @flow
import React from 'react'
import BigTeamHeader from './big-team-header/container'
import BigTeamChannelRow from './big-team-channel/container'
import * as Constants from '../../../constants/chat'

type MakeRowOptions = {
  channelname: ?string,
  conversationIDKey: ?Constants.ConversationIDKey,
  filtered: boolean,
  isActiveRoute: boolean,
  teamname: ?string,
  type: 'small' | 'bigHeader' | 'bigTeamsLabel' | 'big' | 'divider',
}
const makeRow = (options: MakeRowOptions) => {
  // const key =
  // (row.type === 'small' && row.conversationIDKey) ||
  // (row.type === 'bigHeader' && row.teamname) ||
  // (row.type === 'big' && ``) ||
  // 'missingkey'

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
        <BigTeamChannelRow
          key={`${options.teamname || ''}:${options.channelname || ''}`}
          conversationIDKey={options.conversationIDKey}
          channelname={options.channelname}
          isActiveRoute={options.isActiveRoute}
        />
      )
  }
  return null
}

export {makeRow}
