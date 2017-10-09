// @flow
import RenderBlockConversationWarning from './'
import {connect, type TypedState} from '../../../util/container'
import {navigateTo, navigateUp} from '../../../actions/route-tree'
import {chatTab} from '../../../constants/tabs'
import {type RouteProps} from '../../../route-tree/render-route'
import {type BlockConversation, type ConversationIDKey} from '../../../constants/chat'

type RenderBlockConversationWarningRouteProps = RouteProps<
  {
    conversationIDKey: ConversationIDKey,
    participants: string,
  },
  {}
>
type OwnProps = RenderBlockConversationWarningRouteProps

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const {conversationIDKey, participants} = routeProps.toObject()
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
  navToRootChat: () => dispatch(navigateTo([chatTab])),
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
