// @flow
import * as ChatTypes from '../constants/types/chat2'
import * as Chat2Gen from '../actions/chat2-gen'
import {ChatPreview} from './chat.desktop'
import {remoteConnect, compose} from '../util/container'

const mapStateToProps = ({conversations}) => ({conversations})

const mapDispatchToProps = dispatch => ({
  onViewAll: () => dispatch(Chat2Gen.createOpenChatFromWidget({})),
  _onSelectConversation: (conversationIDKey: ChatTypes.ConversationIDKey) => dispatch(Chat2Gen.createOpenChatFromWidget({conversationIDKey})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onViewAll: dispatchProps.onViewAll,
  convRows: stateProps.conversations.map(c => ({
    conversationIDKey: c.conversationIDKey,
    onSelectConversation: () => dispatchProps._onSelectConversation(c.conversationIDKey),
    ...c,
  })),
})

export default compose(
  remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)
)(ChatPreview)
