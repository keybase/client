import RenderBlockConversationWarning from './'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {RouteProps} from '../../../route-tree/render-route'
import {ConversationIDKey} from '../../../constants/types/chat2'

type OwnProps = RouteProps<
  {
    conversationIDKey: ConversationIDKey
  },
  {}
>

const mapStateToProps = (state, ownProps: OwnProps) => {
  const conversationIDKey = Container.getRouteProps(ownProps, 'conversationIDKey')
  const _participants = Constants.getMeta(state, conversationIDKey).participants
  return {
    _participants,
    _you: state.config.username,
    conversationIDKey,
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
  participants: stateProps._participants.filter(p => p !== stateProps._you).join(','),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(
  RenderBlockConversationWarning
)
