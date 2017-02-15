// @flow
import React, {Component} from 'react'
import ConversationList from './index'
import {connect} from 'react-redux'
import {loadInbox, selectConversation, newChat} from '../../actions/chat'
import {newestConversationIDKey} from '../../constants/chat'
import {List} from 'immutable'

import type {ConversationIDKey, InboxState, SupersededByState} from '../../constants/chat'
import type {TypedState} from '../../constants/reducer'

class ConversationListContainer extends Component {
  componentWillMount () {
    this.props.loadInbox()
  }

  render () {
    return <ConversationList {...this.props} />
  }
}

function _filterInboxes (inboxes: List<InboxState>, supersededByState: SupersededByState): List<InboxState> {
  // $FlowIssue with records and accessing things inside them
  return inboxes.filter(i => (!i.isEmpty || i.youCreated) && !supersededByState.get(i.conversationIDKey))
}

export default connect(
  (state: TypedState, {routeSelected}) => ({
    conversationUnreadCounts: state.chat.get('conversationUnreadCounts'),
    inbox: _filterInboxes(state.chat.get('inbox'), state.chat.get('supersededByState')),
    rekeyInfos: state.chat.get('rekeyInfos'),
    selectedConversation: newestConversationIDKey(routeSelected, state.chat),
    you: state.config.username || '',
  }),
  (dispatch: Dispatch) => ({
    loadInbox: () => dispatch(loadInbox()),
    onNewChat: () => dispatch(newChat([])),
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  })
)(ConversationListContainer)
