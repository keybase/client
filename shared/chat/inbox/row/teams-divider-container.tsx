import * as Chat from '@/stores/chat'
import * as React from 'react'
import type {ChatInboxRowItem} from '../rowitem'
import TeamsDivider from './teams-divider'

type Props = Omit<React.ComponentProps<typeof TeamsDivider>, 'badgeCount'> & {
  rows: ReadonlyArray<ChatInboxRowItem>
}

const TeamsDividerContainer = React.memo(function TeamsDividerContainer(props: Props) {
  const {rows, ...rest} = props
  const smallTeamBadgeCount = Chat.useChatState(s => s.smallTeamBadgeCount)

  const visibleBadges = React.useMemo(() => {
    let total = 0
    for (const row of rows) {
      if (row.type === 'small') {
        total += Chat.getConvoState(row.conversationIDKey).badge
      }
    }
    return total
  }, [rows, smallTeamBadgeCount])

  const hiddenSmallBadgeCount = Math.max(0, smallTeamBadgeCount - visibleBadges)
  return <TeamsDivider {...rest} badgeCount={hiddenSmallBadgeCount} />
})

export default TeamsDividerContainer
