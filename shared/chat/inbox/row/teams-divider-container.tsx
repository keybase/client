import * as Chat from '@/stores/chat'
import * as React from 'react'
import type {ChatInboxRowItem} from '../rowitem'
import {useInboxRowsState} from '@/stores/inbox-rows'
import TeamsDivider from './teams-divider'

type Props = Omit<React.ComponentProps<typeof TeamsDivider>, 'badgeCount'> & {
  rows: ReadonlyArray<ChatInboxRowItem>
}

const TeamsDividerContainer = React.memo(function TeamsDividerContainer(props: Props) {
  const {rows, ...rest} = props
  const smallTeamBadgeCount = Chat.useChatState(s => s.smallTeamBadgeCount)

  const visibleSmallConvIDs = React.useMemo(() => {
    const ids: Array<string> = []
    for (const row of rows) {
      if (row.type === 'small') {
        ids.push(row.conversationIDKey)
      }
    }
    return ids
  }, [rows])

  const visibleBadges = useInboxRowsState(
    React.useCallback(s => {
      let total = 0
      for (const conversationIDKey of visibleSmallConvIDs) {
        total += s.rowsSmall.get(conversationIDKey)?.badgeCount ?? 0
      }
      return total
    }, [visibleSmallConvIDs])
  )

  const hiddenSmallBadgeCount = Math.max(0, smallTeamBadgeCount - visibleBadges)
  return <TeamsDivider {...rest} badgeCount={hiddenSmallBadgeCount} />
})

export default TeamsDividerContainer
