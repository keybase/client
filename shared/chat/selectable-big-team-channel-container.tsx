import * as C from '../constants'
import type * as T from '../constants/types'
import SelectableBigTeamChannel from './selectable-big-team-channel'

type OwnProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  isSelected: boolean
  maxSearchHits?: number
  name: string
  numSearchHits?: number
  onSelectConversation: () => void
}

export default (ownProps: OwnProps) => {
  const {isSelected, maxSearchHits, numSearchHits, onSelectConversation, name, conversationIDKey} = ownProps
  const showBold = C.useConvoState(conversationIDKey, s => s.unread > 0)
  const showBadge = C.useConvoState(conversationIDKey, s => s.badge > 0)
  const _meta = C.useConvoState(conversationIDKey, s => s.meta)
  let teamname = _meta.teamname
  let channelname = _meta.channelname
  if (!teamname) {
    const parts = name.split('#')
    if (parts.length >= 2) {
      teamname = parts[0]!
      channelname = parts[1]!
    }
  }
  const props = {
    channelname,
    isSelected,
    maxSearchHits,
    numSearchHits,
    onSelectConversation,
    showBadge,
    showBold: showBold && !isSelected,
    snippet: _meta.snippet,
    snippetDecoration: _meta.snippetDecoration,
    teamname,
  }
  return <SelectableBigTeamChannel {...props} />
}
