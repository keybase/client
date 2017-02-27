// @flow
import ConversationList from './index'
// import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {loadInbox, newChat} from '../../actions/chat'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import * as I from 'immutable'

import type {TypedState} from '../../constants/reducer'

// let _loaded = false

// class ConversationListContainer extends PureComponent {
  // componentWillMount () {
    // if (!_loaded) {
      // _loaded = true
      // this.props.loadInbox()
    // }
  // }

  // render () {
    // const pendingRows = this.props.pending.toList()
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
    // const rows = pendingRows.concat(this.props.inbox)

    // console.log('aaa', this.props.rows.toJS())
    // return <ConversationList
      // rows={this.props.rows}
      // onNewChat={this.props.onNewChat}
    // />
      // // onSelectConversation={this.props.onSelectConversation}
  // }
// }

// function _filterInboxes (inboxes: List<InboxState>, supersededByState: SupersededByState, alwaysShow: Set<ConversationIDKey>): List<ConversationIDKey> {
  // return inboxes.filter(i => (!i.isEmpty || alwaysShow.has(i.conversationIDKey)) && !supersededByState.get(i.conversationIDKey)).map(i => i.conversationIDKey)
// }

const getInbox = (state: TypedState) => state.chat.get('inbox')
const getSupersededByState = (state: TypedState) => state.chat.get('supersededByState')
const getAlwaysShow = (state: TypedState) => state.chat.get('alwaysShow')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')

const createImuutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const filteredInbox = createImuutableEqualSelector(
  [getInbox, getSupersededByState, getAlwaysShow],
  (inbox, supersededByState, alwaysShow) => {
    return inbox.filter(i => (!i.isEmpty || alwaysShow.has(i.conversationIDKey)) &&
        !supersededByState.get(i.conversationIDKey)).map(i => i.conversationIDKey)
  }
)
const getRows = createImuutableEqualSelector(
  [filteredInbox, getPending],
  (inbox, pending) => pending.toList().concat(inbox)
)

export default connect(
  (state: TypedState) => ({
    // pending: state.chat.get('pendingConversations'),
    // inbox: getFilteredInbox(state),
    rows: getRows(state),

    // rawAlwaysShow: state.chat.get('alwaysShow'),
    // rawInbox: state.chat.get('inbox'),
    // rawSupersededByState: state.chat.get('supersededByState'),
    // rekeyInfos: state.chat.get('rekeyInfos'),
    // selectedConversation: newestConversationIDKey(routeSelected, state.chat),
    // you: state.config.username || '',
  }),
  (dispatch: Dispatch) => ({
    loadInbox: () => dispatch(loadInbox()),
    onNewChat: () => dispatch(newChat([])),
    // onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  })
)(ConversationList)

// TEMP
const ConversationListContainer = () => null

export {
  ConversationListContainer,
}
