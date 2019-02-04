// @flow
import RenderBlockConversationWarning from './'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {type RouteProps} from '../../../route-tree/render-route'
import {type ConversationIDKey} from '../../../constants/types/chat2'

type RenderBlockConversationWarningRouteProps = RouteProps<{conversationIDKey: ConversationIDKey}, {}>
type OwnProps = RenderBlockConversationWarningRouteProps

const mapStateToProps = (state, {routeProps}: OwnProps) => {
  const conversationIDKey = routeProps.get('conversationIDKey')
  const participants = Constants.getMeta(state, conversationIDKey).participants.join(',')
  return {
    conversationIDKey,
    participants,
  }
}

const mapDispatchToProps = dispatch => ({
  _onBlock: (conversationIDKey: ConversationIDKey, reportUser: boolean) =>
    dispatch(
      Chat2Gen.createBlockConversation({
        conversationIDKey,
        reportUser,
      })
    ),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  conversationIDKey: stateProps.conversationIDKey,
  onBack: dispatchProps.onBack,
  onBlock: () => dispatchProps._onBlock(stateProps.conversationIDKey, false),
  onBlockAndReport: () => dispatchProps._onBlock(stateProps.conversationIDKey, true),
  participants: stateProps.participants,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(RenderBlockConversationWarning)
