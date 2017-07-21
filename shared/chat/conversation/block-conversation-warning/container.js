// @flow
import RenderBlockConversationWarning from './'
import {connect} from 'react-redux-profiled'
import {navigateTo, navigateUp} from '../../../actions/route-tree'
import {chatTab} from '../../../constants/tabs'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {BlockConversation, ConversationIDKey} from '../../../constants/chat'

type RenderBlockConversationWarningRouteProps = RouteProps<
  {
    conversationIDKey: ConversationIDKey,
    participants: string,
  },
  {}
>
type OwnProps = RenderBlockConversationWarningRouteProps & {}

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const {conversationIDKey, participants} = routeProps
  return {
    conversationIDKey,
    participants,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBlock: (conversationIDKey: ConversationIDKey, reportUser: boolean) =>
    dispatch(
      ({
        payload: {blocked: true, conversationIDKey, reportUser},
        type: 'chat:blockConversation',
      }: BlockConversation)
    ),
  onBack: () => dispatch(navigateUp()),
  navToRootChat: () => dispatch(navigateTo([], [chatTab])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onBlockAndReport: () => {
    dispatchProps.onBlock(stateProps.conversationIDKey, true)
    dispatchProps.navToRootChat()
  },
  onBlock: () => {
    dispatchProps.onBlock(stateProps.conversationIDKey, false)
    dispatchProps.navToRootChat()
  },
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(RenderBlockConversationWarning)
