import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import type {ChatInboxRowItem} from '../rowitem'
import TeamsDivider from './teams-divider'

type Props = Omit<React.ComponentProps<typeof TeamsDivider>, 'badgeCount'> & {
  rows: ReadonlyArray<ChatInboxRowItem>
}

const TeamsDividerContainer = React.memo(function TeamsDividerContainer(props: Props) {
  const {rows, ...rest} = props
  const {badgeStateVersion, smallTeamBadgeCount} = Chat.useChatState(
    C.useShallow(s => ({
      badgeStateVersion: s.badgeStateVersion,
      smallTeamBadgeCount: s.smallTeamBadgeCount,
    }))
  )

  const visibleSmallConvIDs = React.useMemo(() => {
    const ids: Array<string> = []
    for (const row of rows) {
      if (row.type === 'small') {
        ids.push(row.conversationIDKey)
      }
    }
    return ids
  }, [rows])

  const visibleBadges = React.useMemo(() => {
    let total = 0
    for (const conversationIDKey of visibleSmallConvIDs) {
      total += Chat.getConvoState(conversationIDKey).badge
    }
    return {total, version: badgeStateVersion}
  }, [badgeStateVersion, visibleSmallConvIDs]).total

  const hiddenSmallBadgeCount = Math.max(0, smallTeamBadgeCount - visibleBadges)
  return <TeamsDivider {...rest} badgeCount={hiddenSmallBadgeCount} />
})

export default TeamsDividerContainer
