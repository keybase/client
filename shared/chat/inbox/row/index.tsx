import logger from '@/logger'
import BigTeamHeader from './big-team-header'
import BigTeamChannel from './big-team-channel'
import {SmallTeam} from './small-team'
import {BigTeamsLabel} from './big-teams-label'
import type {ChatInboxRowItem} from '../rowitem'

const makeRow = (item: ChatInboxRowItem, navKey: string, selected: boolean) => {
  if (item.type === 'bigTeamsLabel') {
    return <BigTeamsLabel />
  }
  switch (item.type) {
    case 'bigHeader':
      return <BigTeamHeader teamname={item.teamname} teamID={item.teamID} navKey={navKey} />
    case 'big':
      return (
        <BigTeamChannel
          conversationIDKey={item.conversationIDKey}
          layoutChannelname={item.channelname}
          selected={selected}
          navKey={navKey}
          layoutSnippetDecoration={item.snippetDecoration}
        />
      )
    case 'small':
      return (
        <SmallTeam
          isInWidget={false}
          conversationIDKey={item.conversationIDKey}
          layoutIsTeam={item.isTeam}
          layoutName={item.teamname}
          isSelected={selected}
          layoutTime={item.time}
          layoutSnippet={item.snippet}
          layoutSnippetDecoration={item.snippetDecoration}
        />
      )
    default:
  }
  logger.error(`Unhandled row type ${item.type}`)
  return null
}

export {makeRow}
