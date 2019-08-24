import * as Constants from '../constants/chat2'
import SelectableBigTeamChannel from './selectable-big-team-channel'
import * as Types from '../constants/types/chat2'
import {namedConnect} from '../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isSelected: boolean
  maxSearchHits?: number
  numSearchHits?: number
  onSelectConversation: () => void
}

const mapStateToProps = (state, {conversationIDKey}) => {
  const showBold = Constants.getHasUnread(state, conversationIDKey)
  const showBadge = Constants.getHasBadge(state, conversationIDKey)
  const {channelname, teamname} = Constants.getMeta(state, conversationIDKey)
  return {channelname, showBadge, showBold, teamname}
}

const mapDispatchToProps = () => ({})

const mergeProps = (stateProps, _, ownProps: OwnProps) => {
  return {
    channelname: stateProps.channelname,
    isSelected: ownProps.isSelected,
    maxSearchHits: ownProps.maxSearchHits,
    numSearchHits: ownProps.numSearchHits,
    onSelectConversation: ownProps.onSelectConversation,
    showBadge: stateProps.showBadge,
    showBold: stateProps.showBold && !ownProps.isSelected,
    teamname: stateProps.teamname,
  }
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'SelectableBigTeamChannel')(
  SelectableBigTeamChannel
)
