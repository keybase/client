import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import logger from '@/logger'
import BigTeamHeader from './big-team-header'
import BigTeamChannel from './big-team-channel'
import {SmallTeam} from './small-team'
import {BigTeamsLabel} from './big-teams-label'
import {Box} from '@/common-adapters'
import type * as T from '@/constants/types'

const makeRow = (
  item: T.Chat.ChatInboxRowItem,
  navKey: string,
  selected: boolean,
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
        <C.ChatProvider id={C.Chat.dummyConversationIDKey}>
          <BigTeamHeader teamname={item.teamname} teamID={item.teamID} navKey={navKey} />
        </C.ChatProvider>
      )
    case 'big':
      return (
        <C.ChatProvider id={item.conversationIDKey}>
          <BigTeamChannel
            layoutChannelname={item.channelname}
            selected={selected}
            navKey={navKey}
            layoutSnippetDecoration={item.snippetDecoration}
          />
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
            isSelected={selected}
            layoutTime={item.time}
            layoutSnippet={item.snippet}
            layoutSnippetDecoration={item.snippetDecoration}
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
  ...Kb.Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  height: Kb.Styles.isMobile ? 32 : 24,
  marginLeft: Kb.Styles.globalMargins.tiny,
} as const

export {makeRow}
