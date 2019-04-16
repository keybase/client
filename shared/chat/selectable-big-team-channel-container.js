// @flow
import * as Constants from '../constants/chat2'
import * as Styles from '../styles'
import SelectableBigTeamChannel from './selectable-big-team-channel'
import * as Types from '../constants/types/chat2'
import {namedConnect} from '../util/container'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  isSelected: boolean,
  maxSearchHits?: number,
  numSearchHits?: number,
  onSelectConversation: () => void,
|}

const mapStateToProps = (state, {conversationIDKey}) => {
  const showBold = Constants.getHasUnread(state, conversationIDKey)
  const showBadge = Constants.getHasBadge(state, conversationIDKey)
  const {channelname, teamname} = Constants.getMeta(state, conversationIDKey)
  return {channelname, showBadge, showBold, teamname}
}

const mapDispatchToProps = () => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = ownProps.isSelected && !Styles.isMobile
  return {
    channelname: stateProps.channelname,
    isSelected,
    maxSearchHits: ownProps.maxSearchHits,
    numSearchHits: ownProps.numSearchHits,
    onSelectConversation: ownProps.onSelectConversation,
    showBadge: stateProps.showBadge,
    showBold: stateProps.showBold && !isSelected,
    teamname: stateProps.teamname,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SelectableBigTeamChannel'
)(SelectableBigTeamChannel)
