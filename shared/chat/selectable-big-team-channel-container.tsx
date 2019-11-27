import * as Constants from '../constants/chat2'
import SelectableBigTeamChannel from './selectable-big-team-channel'
import * as Types from '../constants/types/chat2'
import {namedConnect} from '../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isSelected: boolean
  maxSearchHits?: number
  name: string
  numSearchHits?: number
  onSelectConversation: () => void
}

const mapStateToProps = (state, {conversationIDKey}) => {
  const showBold = Constants.getHasUnread(state, conversationIDKey)
  const showBadge = Constants.getHasBadge(state, conversationIDKey)
  const _meta = Constants.getMeta(state, conversationIDKey)
  return {_meta, showBadge, showBold}
}

const mapDispatchToProps = () => ({})

const mergeProps = (stateProps, _, ownProps: OwnProps) => {
  let teamname = stateProps._meta.teamname
  let channelname = stateProps._meta.channelname
  if (!teamname) {
    const parts = ownProps.name.split('#')
    if (parts.length >= 2) {
      teamname = parts[0]
      channelname = parts[1]
    }
  }
  return {
    channelname,
    isSelected: ownProps.isSelected,
    maxSearchHits: ownProps.maxSearchHits,
    numSearchHits: ownProps.numSearchHits,
    onSelectConversation: ownProps.onSelectConversation,
    showBadge: stateProps.showBadge,
    showBold: stateProps.showBold && !ownProps.isSelected,
    snippet: stateProps._meta.snippet,
    snippetDecoration: stateProps._meta.snippetDecoration,
    teamname,
  }
}

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SelectableBigTeamChannel'
)(SelectableBigTeamChannel)
