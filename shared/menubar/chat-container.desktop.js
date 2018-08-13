// @flow
import * as ConfigGen from '../actions/config-gen'
import * as Tabs from '../constants/tabs'
import * as ChatTypes from '../constants/types/chat2'
import * as Chat2Gen from '../actions/chat2-gen'
import {switchTo} from '../actions/route-tree'
import {default as Chat} from './chat.desktop'
import {connect, compose, type Dispatch} from '../util/container'

const mapStateToProps = (state) => ({
  conversations: state.conversations,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onViewAll: () => {
    dispatch(ConfigGen.createShowMain())
    dispatch(switchTo([Tabs.chatTab]))
  },
  _onSelectConversation: (conversationIDKey: ChatTypes.ConversationIDKey) => {
    dispatch(ConfigGen.createShowMain())
    dispatch(switchTo([Tabs.chatTab]))
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSmall'}))
  },
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
  connect(mapStateToProps, mapDispatchToProps, mergeProps)
)(Chat)
