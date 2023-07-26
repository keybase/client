import * as React from 'react'
import logger from '../../../logger'
import BigTeamHeader from './big-team-header'
import BigTeamChannel from './big-team-channel'
import SmallTeam from './small-team/container'
import {BigTeamsLabel} from './big-teams-label'
import {Box} from '../../../common-adapters'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
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
        <Constants.Provider id={item.conversationIDKey}>
          <BigTeamChannel
            conversationIDKey={item.conversationIDKey}
            layoutChannelname={item.channelname}
            selected={item.selected}
            navKey={navKey}
          />
        </Constants.Provider>
      )
    case 'small':
      return (
        <Constants.Provider id={item.conversationIDKey}>
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
        </Constants.Provider>
      )
    default:
  }
  logger.error(`Unhandled row type ${item.type}`)
  return null
}

const _bigTeamLabelStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  height: Styles.isMobile ? 32 : 24,
  marginLeft: Styles.globalMargins.tiny,
}

export {makeRow}
