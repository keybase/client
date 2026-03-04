import logger from '@/logger'
import BigTeamHeader from './big-team-header'
import BigTeamChannel from './big-team-channel'
import {SmallTeam} from './small-team'
import type {ChatInboxRowItem, InboxSmallTeamRow, InboxBigChannelRow} from '../rowitem'

const makeRow = (item: ChatInboxRowItem, selected: boolean) => {
  switch (item.type) {
    case 'bigHeader':
      return <BigTeamHeader teamname={item.teamname} teamID={item.teamID} />
    case 'big':
      return <BigTeamChannel row={item as InboxBigChannelRow} selected={selected} />
    case 'small':
      return <SmallTeam row={item as InboxSmallTeamRow} isSelected={selected} />
    default:
  }
  logger.error(`Unhandled row type ${item.type}`)
  return null
}

export {makeRow}
