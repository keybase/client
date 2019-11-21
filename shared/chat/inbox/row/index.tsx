import React from 'react'
import logger from '../../../logger'
import BigTeamHeader from './big-team-header/container'
import BigTeamChannel from './big-team-channel/container'
import SmallTeam from './small-team/container'
import {BigTeamsLabel} from './big-teams-label'
import {Box} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import * as TeamTypes from '../../../constants/types/teams'

type MakeRowOptions = {
  channelname: string
  conversationIDKey: Types.ConversationIDKey
  isTeam: boolean
  navKey: string
  snippet?: string
  snippetDecoration?: string
  teamname: string
  teamID: TeamTypes.TeamID
  time?: number
  type: 'small' | 'bigHeader' | 'bigTeamsLabel' | 'big'
}

const makeRow = (options: MakeRowOptions) => {
  if (options.type === 'bigTeamsLabel') {
    return (
      <Box style={_bigTeamLabelStyle} key="bigTeamsLabel">
        <BigTeamsLabel />
      </Box>
    )
  }
  switch (options.type) {
    case 'bigHeader':
      return (
        <BigTeamHeader
          key={options.teamname}
          teamname={options.teamname}
          teamID={options.teamID}
          conversationIDKey={options.conversationIDKey}
          navKey={options.navKey}
        />
      )
    case 'big':
      return (
        <BigTeamChannel
          key={options.conversationIDKey}
          conversationIDKey={options.conversationIDKey}
          channelname={options.channelname}
          navKey={options.navKey}
        />
      )
    case 'small':
      return (
        <SmallTeam
          key={options.conversationIDKey}
          conversationIDKey={options.conversationIDKey}
          isTeam={options.isTeam}
          navKey={options.navKey}
          name={options.teamname}
          time={options.time || 0}
          snippet={options.snippet}
          snippetDecoration={options.snippetDecoration}
        />
      )
  }
  logger.error(`Unhandled row type ${options.type}`)
  return null
}

const _bigTeamLabelStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: isMobile ? 32 : 24,
  marginLeft: globalMargins.tiny,
}

export {makeRow}
