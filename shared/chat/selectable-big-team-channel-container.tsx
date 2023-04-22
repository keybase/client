import * as Constants from '../constants/chat2'
import SelectableBigTeamChannel from './selectable-big-team-channel'
import type * as Types from '../constants/types/chat2'
import * as Container from '../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isSelected: boolean
  maxSearchHits?: number
  name: string
  numSearchHits?: number
  onSelectConversation: () => void
}

export default (ownProps: OwnProps) => {
  const {conversationIDKey, isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = ownProps
  const showBold = Container.useSelector(state => Constants.getHasUnread(state, conversationIDKey))
  const showBadge = Container.useSelector(state => Constants.getHasBadge(state, conversationIDKey))
  const _meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  let teamname = _meta.teamname
  let channelname = _meta.channelname
  if (!teamname) {
    const parts = name.split('#')
    if (parts.length >= 2) {
      teamname = parts[0]
      channelname = parts[1]
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
