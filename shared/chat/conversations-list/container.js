// @flow
import React, {Component} from 'react'
import ConversationList from './index'
import {connect} from 'react-redux'
import {loadInbox, selectConversation, newChat} from '../../actions/chat'

import type {ConversationIDKey} from '../../constants/chat'
import type {TypedState} from '../../constants/reducer'

class ConversationListContainer extends Component {
  componentWillMount () {
    this.props.loadInbox()
  }

  render () {
    return <ConversationList {...this.props} />
  }
}

export default connect(
  (state: TypedState, {routeSelected}) => ({
    conversationUnreadCounts: state.chat.get('conversationUnreadCounts'),
    inbox: state.chat.get('inbox'),
    rekeyInfos: state.chat.get('rekeyInfos'),
    selectedConversation: routeSelected,
    you: state.config.username || '',
  }),
  (dispatch: Dispatch) => ({
    loadInbox: () => dispatch(loadInbox()),
    onNewChat: () => dispatch(newChat([])),
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  })
)(ConversationListContainer)
