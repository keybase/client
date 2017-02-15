// @flow
import ConversationList from './index'
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors} from '../../styles'
import {loadInbox, selectConversation, newChat} from '../../actions/chat'
import {participantFilter, pendingConversationIDKey, newestConversationIDKey} from '../../constants/chat'
import {List} from 'immutable'

import type {ConversationIDKey, InboxState, SupersededByState} from '../../constants/chat'
import type {TypedState} from '../../constants/reducer'

class ConversationListContainer extends Component {
  componentWillMount () {
    this.props.loadInbox()
  }

  _derivedProps (rekeyInfo, unreadCount, isSelected) {
    // Derived props
    const youNeedToRekey = rekeyInfo && !rekeyInfo.get('rekeyParticipants').count() && rekeyInfo.get('youCanRekey')
    const participantNeedToRekey = rekeyInfo && !!rekeyInfo.get('rekeyParticipants').count()
    const hasUnread = !!unreadCount
    const subColor = isSelected ? globalColors.black_40 : hasUnread ? globalColors.white : globalColors.blue3_40
    const showBold = !isSelected && hasUnread
    const backgroundColor = isSelected ? globalColors.white : hasUnread ? globalColors.darkBlue : globalColors.darkBlue4
    const usernameColor = isSelected ? globalColors.black_75 : hasUnread ? globalColors.white : globalColors.blue3_60
    const commaColor = isSelected ? globalColors.black_60 : hasUnread ? globalColors.white_75 : globalColors.blue3_40

    return {
      backgroundColor,
      commaColor,
      hasUnread,
      participantNeedToRekey,
      showBold,
      subColor,
      usernameColor,
      youNeedToRekey,
    }
  }

  render () {
    const pendingRows = this.props.pending.map(pending => {
      const conversationIDKey: ConversationIDKey = pendingConversationIDKey(pending.sort().join(','))
      const unreadCount = 0
      const participants = participantFilter(pending, this.props.you)
      const isSelected = this.props.selectedConversation === conversationIDKey
      const isMuted = false
      const rekeyInfo = null
      const timestamp = formatTimeForConversationList(Date.now(), this.props.nowOverride)
      const snippet = ''
      const onSelectConversation = this.props.onSelectConversation

      return {
        conversationIDKey,
        isMuted,
        isSelected,
        onSelectConversation,
        participants,
        rekeyInfo,
        snippet,
        timestamp,
        unreadCount,
      }
    })

    const realRows = this.props.inbox.map(conversation => {
      const conversationIDKey: ConversationIDKey = conversation.get('conversationIDKey')
      const unreadCount = this.props.conversationUnreadCounts.get(conversationIDKey)
      const participants = participantFilter(conversation.get('participants'), this.props.you)
      const isSelected = this.props.selectedConversation === conversationIDKey
      const isMuted = conversation.get('muted')
      const rekeyInfo = this.props.selectedConversation && this.props.rekeyInfos.get(conversationIDKey)
      const timestamp = formatTimeForConversationList(conversation.get('time'), this.props.nowOverride)
      const snippet = conversation.get('snippet')
      const onSelectConversation = this.props.onSelectConversation

      return {
        conversationIDKey,
        isMuted,
        isSelected,
        onSelectConversation,
        participants,
        rekeyInfo,
        snippet,
        timestamp,
        unreadCount,
      }
    })

    const rows = pendingRows.concat(realRows).map(props => ({
      ...props,
      ...this._derivedProps(props.rekeyInfo, props.unreadCount, props.isSelected),
    }))

    return <ConversationList
      children={this.props.children}
      onNewChat={this.props.onNewChat}
      onSelectConversation={this.props.onSelectConversation}
      rows={rows}
    />
  }
}

function _filterInboxes (inboxes: List<InboxState>, supersededByState: SupersededByState, alwaysShow: Set<ConversationIDKey>): List<InboxState> {
  // $FlowIssue with records and accessing things inside them
  return inboxes.filter(i => (!i.isEmpty || alwaysShow.has(i.conversationIDKey)) && !supersededByState.get(i.conversationIDKey))
}

export default connect(
  (state: TypedState, {routeSelected}) => ({
    conversationUnreadCounts: state.chat.get('conversationUnreadCounts'),
    inbox: _filterInboxes(state.chat.get('inbox'), state.chat.get('supersededByState'), state.chat.get('alwaysShow')),
    pending: state.chat.get('pendingConversations'),
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

export {
  ConversationListContainer,
}
