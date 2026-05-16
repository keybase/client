import {useInboxRowBig} from '@/stores/inbox-rows'
import SelectableBigTeamChannel from '@/chat/selectable-big-team-channel'
import type * as T from '@/constants/types'

type OwnProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  isSelected: boolean
  maxSearchHits?: number
  name: string
  numSearchHits?: number
  onSelectConversation: () => void
}

const Container = (ownProps: OwnProps) => {
  const {conversationIDKey, isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} =
    ownProps
  const row = useInboxRowBig(conversationIDKey)
  const showBold = row.hasUnread
  const showBadge = row.hasBadge
  let teamname = row.teamname
  let channelname = row.channelname
  if (!teamname) {
    const parts = name.split('#')
    if (parts.length >= 2) {
      teamname = parts[0]!
      channelname = parts[1]!
    }
  }
  const props = {
    channelname,
    conversationIDKey,
    isSelected,
    maxSearchHits,
    numSearchHits,
    onSelectConversation,
    showBadge,
    showBold: showBold && !isSelected,
    snippet: row.snippet,
    snippetDecoration: row.snippetDecoration,
    teamname,
  }
  return <SelectableBigTeamChannel {...props} />
}

export default Container
