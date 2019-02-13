// @flow
import * as Constants from '../constants/chat2'
import SelectableBigTeamChannel from './selectable-big-team-channel'
import * as Types from '../constants/types/chat2'
import {namedConnect} from '../util/container'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  isSelected: boolean,
  onSelectConversation: () => void,
|}

const mapStateToProps = (state, {conversationIDKey}) => {
  const {channelname, teamname} = Constants.getMeta(state, conversationIDKey)
  return {channelname, hasBadge: Constants.getHasBadge(state, conversationIDKey), teamname}
}

const mapDispatchToProps = () => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps.channelname,
  hasBadge: stateProps.hasBadge,
  isSelected: ownProps.isSelected,
  onSelectConversation: ownProps.onSelectConversation,
  teamname: stateProps.teamname,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SelectableBigTeamChannel'
)(SelectableBigTeamChannel)
