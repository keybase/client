import * as C from '../../../constants'
import * as React from 'react'
import logger from '../../../logger'
import BigTeamHeader from './big-team-header'
import BigTeamChannel from './big-team-channel'
import SmallTeam from './small-team/container'
import {BigTeamsLabel} from './big-teams-label'
import {Box} from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as T from '../../../constants/types'

const makeRow = (
  item: T.Chat.ChatInboxRowItem,
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
      return (
        <C.ChatProvider id={C.dummyConversationIDKey}>
          <BigTeamHeader teamname={item.teamname} teamID={item.teamID} navKey={navKey} />
        </C.ChatProvider>
      )
    case 'big':
      return (
        <C.ChatProvider id={item.conversationIDKey}>
          <BigTeamChannel layoutChannelname={item.channelname} selected={item.selected} navKey={navKey} />
        </C.ChatProvider>
      )
    case 'small':
      return (
        <C.ChatProvider id={item.conversationIDKey}>
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
        </C.ChatProvider>
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
