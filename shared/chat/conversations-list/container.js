// @flow
import ConversationList from './index'
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {loadInbox, newChat} from '../../actions/chat'
import {List} from 'immutable'

import type {ConversationIDKey, InboxState, SupersededByState} from '../../constants/chat'
import type {TypedState} from '../../constants/reducer'

let _loaded = false

class ConversationListContainer extends Component {
  componentWillMount () {
    if (!_loaded) {
      _loaded = true
      this.props.loadInbox()
    }
  }

  render () {
    const pendingRows = this.props.pending.toList()
    // const pendingRows = this.props.pending.map((users, conversationIDKey) => {
      // const unreadCount = 0
      // const participants = participantFilter(users, this.props.you)
      // const isSelected = this.props.selectedConversation === conversationIDKey
      // const isMuted = false
      // const rekeyInfo = null
      // const timestamp = formatTimeForConversationList(Date.now(), this.props.nowOverride)
      // const snippet = ''
      // const onSelectConversation = this.props.onSelectConversation

      // return {
        // conversationIDKey,
        // isMuted,
        // isSelected,
        // onSelectConversation,
        // participants,
        // rekeyInfo,
        // snippet,
        // timestamp,
        // unreadCount,
      // }
    // }).toList()

    // const realRows = this.props.inbox.map(conversation => {
      // const conversationIDKey: ConversationIDKey = conversation.get('conversationIDKey')
      // const unreadCount = this.props.conversationUnreadCounts.get(conversationIDKey)
      // const participants = participantFilter(conversation.get('participants'), this.props.you)
      // const isSelected = this.props.selectedConversation === conversationIDKey
      // const isMuted = conversation.get('muted')
      // const rekeyInfo = this.props.selectedConversation && this.props.rekeyInfos.get(conversationIDKey)
      // const timestamp = formatTimeForConversationList(conversation.get('time'), this.props.nowOverride)
      // const snippet = conversation.get('snippet')
      // const onSelectConversation = this.props.onSelectConversation

      // return {
        // conversationIDKey,
        // isMuted,
        // isSelected,
        // onSelectConversation,
        // participants,
        // rekeyInfo,
        // snippet,
        // timestamp,
        // unreadCount,
      // }
    // })

    // const rows = pendingRows.concat(realRows).map(props => ({
      // ...props,
      // ...this._derivedProps(props.rekeyInfo, props.unreadCount, props.isSelected),
    // }))
    //
    const rows = pendingRows.concat(this.props.inbox)

    return <ConversationList
      children={this.props.children}
      rows={rows}
      onNewChat={this.props.onNewChat}
    />
      // onSelectConversation={this.props.onSelectConversation}
  }
}

function _filterInboxes (inboxes: List<InboxState>, supersededByState: SupersededByState, alwaysShow: Set<ConversationIDKey>): List<ConversationIDKey> {
  // $FlowIssue with records and accessing things inside them
  return inboxes.filter(i => (!i.isEmpty || alwaysShow.has(i.conversationIDKey)) && !supersededByState.get(i.conversationIDKey)).map(i => i.conversationIDKey)
}

export default connect(
  (state: TypedState, {routeSelected}) => ({
    pending: state.chat.get('pendingConversations'),
    rawAlwaysShow: state.chat.get('alwaysShow'),
    rawInbox: state.chat.get('inbox'),
    rawSupersededByState: state.chat.get('supersededByState'),
    // rekeyInfos: state.chat.get('rekeyInfos'),
    // selectedConversation: newestConversationIDKey(routeSelected, state.chat),
    // you: state.config.username || '',
  }),
  (dispatch: Dispatch) => ({
    loadInbox: () => dispatch(loadInbox()),
    onNewChat: () => dispatch(newChat([])),
    // onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  }),
  (stateProps, dispatchProps, ownProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    inbox: _filterInboxes(stateProps.rawInbox, stateProps.rawSupersededByState, stateProps.rawAlwaysShow),
  })
)(ConversationListContainer)

export {
  ConversationListContainer,
}
