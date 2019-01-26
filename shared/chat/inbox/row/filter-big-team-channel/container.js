// @flow
import SelectableBigTeamChannel from '../../../selectable-big-team-channel-container'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {namedConnect, isMobile} from '../../../../util/container'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
|}

const mapStateToProps = (state, {conversationIDKey}) => ({
  isSelected: Constants.getSelectedConversation(state) === conversationIDKey,
})

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxBig'}))
    if (isMobile) {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['conversation']}))
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  conversationIDKey: ownProps.conversationIDKey,
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'FilterBigTeamChannel'
)(SelectableBigTeamChannel)
