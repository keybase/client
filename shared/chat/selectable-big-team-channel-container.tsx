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

export default Container.connect(
  (state, {conversationIDKey}: OwnProps) => {
    const showBold = Constants.getHasUnread(state, conversationIDKey)
    const showBadge = Constants.getHasBadge(state, conversationIDKey)
    const _meta = Constants.getMeta(state, conversationIDKey)
    return {_meta, showBadge, showBold}
  },
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => {
    const {_meta, showBadge, showBold} = stateProps
    const {isSelected, maxSearchHits, numSearchHits, onSelectConversation, name} = ownProps
    let teamname = _meta.teamname
    let channelname = _meta.channelname
    if (!teamname) {
      const parts = name.split('#')
      if (parts.length >= 2) {
        teamname = parts[0]
        channelname = parts[1]
      }
    }
    return {
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
  }
)(SelectableBigTeamChannel)
