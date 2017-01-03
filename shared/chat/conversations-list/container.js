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
    inbox: state.chat.get('inbox'),
    selectedConversation: routeSelected,
  }),
  (dispatch: Dispatch) => ({
    loadInbox: () => dispatch(loadInbox()),
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
    onNewChat: () => dispatch(newChat([])),
  })
)(ConversationListContainer)
