import logger from '@/logger'
import BigTeamHeader from './big-team-header'
import BigTeamChannel from './big-team-channel'
import {SmallTeam} from './small-team'
import type {ChatInboxRowItem} from '../rowitem'

const makeRow = (
  item: ChatInboxRowItem,
  selected: boolean,
  chosenChannelsTeamnames?: ReadonlySet<string>
) => {
  switch (item.type) {
    case 'bigHeader':
      return (
        <BigTeamHeader
          showBadge={chosenChannelsTeamnames ? !chosenChannelsTeamnames.has(item.teamname) : false}
          teamname={item.teamname}
          teamID={item.teamID}
        />
      )
    case 'big':
      return <BigTeamChannel conversationIDKey={item.conversationIDKey} selected={selected} />
    case 'small':
      return <SmallTeam conversationIDKey={item.conversationIDKey} isSelected={selected} />
    default:
  }
  logger.error(`Unhandled row type ${item.type}`)
  return null
}

export {makeRow}
