import RenderBlockConversationWarning from './'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {ConversationIDKey} from '../../../constants/types/chat2'

type OwnProps = Container.RouteProps<{conversationIDKey: ConversationIDKey}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const conversationIDKey = Container.getRouteProps(
      ownProps,
      'conversationIDKey',
      Constants.noConversationIDKey
    )
    const _participants = Constants.getMeta(state, conversationIDKey).participants
    return {
      _participants,
      _you: state.config.username,
      conversationIDKey,
    }
  },
  dispatch => ({
    _onBlock: (conversationIDKey: ConversationIDKey, reportUser: boolean) =>
      dispatch(
        Chat2Gen.createBlockConversation({
          conversationIDKey,
          reportUser,
        })
      ),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    conversationIDKey: stateProps.conversationIDKey,
    onBack: dispatchProps.onBack,
    onBlock: () => dispatchProps._onBlock(stateProps.conversationIDKey, false),
    onBlockAndReport: () => dispatchProps._onBlock(stateProps.conversationIDKey, true),
    participants: stateProps._participants.filter(p => p !== stateProps._you).join(','),
  })
)(RenderBlockConversationWarning)
