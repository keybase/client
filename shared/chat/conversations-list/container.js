// @flow
import ConversationList from './index'
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors} from '../../styles'
import {loadInbox, selectConversation, newChat} from '../../actions/chat'
import {participantFilter} from '../../constants/chat'

import type {ConversationIDKey} from '../../constants/chat'
import type {TypedState} from '../../constants/reducer'

class ConversationListContainer extends Component {
  componentWillMount () {
    this.props.loadInbox()
  }

  render () {
    const rows = this.props.inbox.map(conversation => {
      const conversationIDKey: ConversationIDKey = conversation.get('conversationIDKey')
      const unreadCount = this.props.conversationUnreadCounts.get(conversationIDKey)
      const participants = participantFilter(conversation.get('participants'), this.props.you)
      const isSelected = this.props.selectedConversation === conversationIDKey
      const isMuted = conversation.get('muted')
      const rekeyInfo = this.props.selectedConversation && this.props.rekeyInfos.get(conversationIDKey)
      const timestamp = formatTimeForConversationList(conversation.get('time'), this.props.nowOverride)
      const snippet = conversation.get('snippet')
      const onSelectConversation = this.props.onSelectConversation

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
        conversationIDKey,
        hasUnread,
        isMuted,
        isSelected,
        onSelectConversation,
        participantNeedToRekey,
        participants,
        rekeyInfo,
        showBold,
        snippet,
        subColor,
        timestamp,
        unreadCount,
        usernameColor,
        youNeedToRekey,
      }
    })

    return <ConversationList
      children={this.props.children}
      onNewChat={this.props.onNewChat}
      onSelectConversation={this.props.onSelectConversation}
      rows={rows}
    />
  }
}

export default connect(
  (state: TypedState, {routeSelected}) => ({
    conversationUnreadCounts: state.chat.get('conversationUnreadCounts'),
    inbox: state.chat.get('inbox').filter(i => !i.isEmpty || i.youCreated),
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

export {
  ConversationListContainer,
}
