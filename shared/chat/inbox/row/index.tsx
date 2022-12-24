import * as React from 'react'
import logger from '../../../logger'
import BigTeamHeader from './big-team-header'
import BigTeamChannel from './big-team-channel'
import SmallTeam from './small-team/container'
import {BigTeamsLabel} from './big-teams-label'
import {Box} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../styles'
import type * as Types from '../../../constants/types/chat2'

const makeRow = (
  item: Types.ChatInboxRowItem,
  navKey: string,
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
) => {
  if (item.type === 'bigTeamsLabel') {
    return (
      <Box style={_bigTeamLabelStyle}>
        <BigTeamsLabel />
      </Box>
    )
  }
  switch (item.type) {
    case 'bigHeader':
      return <BigTeamHeader teamname={item.teamname} teamID={item.teamID} navKey={navKey} />
    case 'big':
      return (
        <BigTeamChannel
          conversationIDKey={item.conversationIDKey}
          layoutChannelname={item.channelname}
          selected={item.selected}
          navKey={navKey}
        />
      )
    case 'small':
      return (
        <SmallTeam
          isInWidget={false}
          conversationIDKey={item.conversationIDKey}
          layoutIsTeam={item.isTeam}
          layoutName={item.teamname}
          isSelected={item.selected}
          layoutTime={item.time}
          layoutSnippet={item.snippet}
          swipeCloseRef={swipeCloseRef}
        />
      )
    default:
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
