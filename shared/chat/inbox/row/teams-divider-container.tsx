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
  Chat.useChatState(s => s.badgeStateVersion)

  const visibleSmallConvIDs = React.useMemo(() => {
    const ids: Array<string> = []
    for (const row of rows) {
      if (row.type === 'small') {
        ids.push(row.conversationIDKey)
      }
    }
    return ids
  }, [rows])

  let visibleBadges = 0
  for (const conversationIDKey of visibleSmallConvIDs) {
    visibleBadges += Chat.getConvoState(conversationIDKey).badge
  }

  const hiddenSmallBadgeCount = Math.max(0, smallTeamBadgeCount - visibleBadges)
  return <TeamsDivider {...rest} badgeCount={hiddenSmallBadgeCount} />
})

export default TeamsDividerContainer
