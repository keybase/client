// @flow
import RenderBlockConversationWarning from './'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {BlockConversation, ConversationIDKey} from '../../../constants/chat'

type RenderBlockConversationWarningRouteProps = RouteProps<{
  conversationIDKey: ConversationIDKey,
  participants: string,
}, {}>
type OwnProps = RenderBlockConversationWarningRouteProps & {}

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const {conversationIDKey, participants} = routeProps
  return {
    conversationIDKey,
    participants,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBlock: (conversationIDKey: ConversationIDKey) => dispatch(({payload: {blocked: true, conversationIDKey}, type: 'chat:blockConversation'}: BlockConversation)),
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onBlock: () => {
    dispatchProps.onBlock(stateProps.conversationIDKey)
    dispatchProps.onBack()
  },
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(RenderBlockConversationWarning)
