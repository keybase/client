import React from 'react'
import logger from '../../../logger'
import BigTeamHeader from './big-team-header'
import BigTeamChannel from './big-team-channel'
import SmallTeam from './small-team/container'
import {BigTeamsLabel} from './big-teams-label'
import {Box} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../styles'
import type * as Types from '../../../constants/types/chat2'

const makeRow = (item: Types.ChatInboxRowItem, navKey: string) => {
  if (item.type === 'bigTeamsLabel') {
    return (
      <Box style={_bigTeamLabelStyle} key="bigTeamsLabel">
        <BigTeamsLabel />
      </Box>
    )
  }
  switch (item.type) {
    case 'bigHeader':
      return (
        <BigTeamHeader key={item.teamname} teamname={item.teamname} teamID={item.teamID} navKey={navKey} />
      )
    case 'big':
      return (
        <BigTeamChannel
          key={item.conversationIDKey}
          conversationIDKey={item.conversationIDKey}
          channelname={item.channelname}
          selected={item.selected}
          navKey={navKey}
        />
      )
    case 'small':
      return (
        <SmallTeam
          key={item.conversationIDKey}
          conversationIDKey={item.conversationIDKey}
          isTeam={item.isTeam}
          navKey={navKey}
          name={item.teamname}
          selected={item.selected}
          time={item.time || 0}
          snippet={item.snippet}
          snippetDecoration={item.snippetDecoration}
        />
      )
  }
  logger.error(`Unhandled row type ${item.type}`)
  return null
}

const _bigTeamLabelStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: isMobile ? 32 : 24,
  marginLeft: globalMargins.tiny,
}

export {makeRow}
