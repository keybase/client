// @noflow
// import RenderBlockConversationWarning from './'
// import * as ChatGen from '../../../actions/chat-gen'
// import {connect, type TypedState} from '../../../util/container'
// import {navigateTo, navigateUp} from '../../../actions/route-tree'
// import {chatTab} from '../../../constants/tabs'
// import {type RouteProps} from '../../../route-tree/render-route'
// import {type ConversationIDKey} from '../../../constants/types/chat2'

// type RenderBlockConversationWarningRouteProps = RouteProps<
// {
// conversationIDKey: ConversationIDKey,
// participants: string,
// },
// {}
// >
// type OwnProps = RenderBlockConversationWarningRouteProps

// const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
// const {conversationIDKey, participants} = routeProps.toObject()
// return {
// conversationIDKey,
// participants,
// }
// }

// const mapDispatchToProps = (dispatch: Dispatch) => ({
// onBlock: (conversationIDKey: ConversationIDKey, reportUser: boolean) =>
// dispatch(
// ChatGen.createBlockConversation({
// blocked: true,
// conversationIDKey,
// reportUser,
// })
// ),
// onBack: () => dispatch(navigateUp()),
// navToRootChat: () => dispatch(navigateTo([chatTab])),
// })

// const mergeProps = (stateProps, dispatchProps, ownProps) => ({
// ...stateProps,
// ...dispatchProps,
// ...ownProps,
// onBlockAndReport: () => {
// dispatchProps.onBlock(stateProps.conversationIDKey, true)
// dispatchProps.navToRootChat()
// },
// onBlock: () => {
// dispatchProps.onBlock(stateProps.conversationIDKey, false)
// dispatchProps.navToRootChat()
// },
// })

// export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(RenderBlockConversationWarning)
