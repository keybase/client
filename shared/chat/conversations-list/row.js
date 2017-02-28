// @flow
import {chatTab} from '../../constants/tabs'
import {connect} from 'react-redux'
import {formatTimeForConversationList} from '../../util/timestamp'
import {getPath} from '../../route-tree'
import {globalColors} from '../../styles'
import {isPendingConversationIDKey, newestConversationIDKey, participantFilter, nothingSelected} from '../../constants/chat'
import {selectConversation} from '../../actions/chat'

import type {TypedState} from '../../constants/reducer'
import type {ConversationIDKey} from '../../constants/chat'

const _selectedSelector = (state: TypedState) => {
  const chatPath = getPath(state.routeTree.routeState, [chatTab])
  if (chatPath.get(0) !== chatTab) {
    return null
  }
  const selected = chatPath.get(1)
  if (selected === nothingSelected) {
    return null
  }
  return selected
}

function _rowDerivedProps (rekeyInfo, unreadCount, isSelected) {
  // Derived props
  const youNeedToRekey = rekeyInfo && !rekeyInfo.get('rekeyParticipants').count() && rekeyInfo.get('youCanRekey')
  const participantNeedToRekey = rekeyInfo && !!rekeyInfo.get('rekeyParticipants').count()
  const hasUnread = !!unreadCount
  const subColor = isSelected ? globalColors.black_40 : hasUnread ? globalColors.white : globalColors.blue3_40
  const showBold = !isSelected && hasUnread
  const backgroundColor = isSelected ? globalColors.white : hasUnread ? globalColors.darkBlue : globalColors.darkBlue4
  const usernameColor = isSelected ? globalColors.black_75 : hasUnread ? globalColors.white : globalColors.blue3_60

  return {
    backgroundColor,
    hasUnread,
    participantNeedToRekey,
    showBold,
    subColor,
    usernameColor,
    youNeedToRekey,
  }
}

// $FlowIssue
const RowConnector = connect(
  (state: TypedState, {conversationIDKey, nowOverride}) => {
    // returns a closure!
    const isPending = isPendingConversationIDKey(conversationIDKey)
    const users = state.chat.get('pendingConversations').findKey(v => v === conversationIDKey)
    return (state: TypedState) => {
      const you = state.config.username || ''
      const selectedConversation = newestConversationIDKey(_selectedSelector(state), state.chat)
      const isSelected = selectedConversation === conversationIDKey
      const rekeyInfos = state.chat.get('rekeyInfos')

      if (isPending) {
        const unreadCount = 0
        const participants = participantFilter(users, you)
        const isMuted = false
        const rekeyInfo = null
        const timestamp = formatTimeForConversationList(Date.now(), nowOverride)
        const snippet = ''

        return {
          conversationIDKey,
          isMuted,
          isSelected,
          participants,
          rekeyInfo,
          snippet,
          timestamp,
          unreadCount,
          ..._rowDerivedProps(rekeyInfo, unreadCount, isSelected),
        }
      } else {
        const conversation = state.chat.get('inbox').find(i => i.get('conversationIDKey') === conversationIDKey)
        const unreadCount = state.chat.get('conversationUnreadCounts').get(conversationIDKey)
        const participants = participantFilter(conversation.get('participants'), you)
        const isMuted = conversation.get('muted')
        const rekeyInfo = rekeyInfos.get(conversationIDKey)
        const timestamp = formatTimeForConversationList(conversation.get('time'), nowOverride)
        const snippet = conversation.get('snippet')

        return {
          conversationIDKey,
          isMuted,
          isSelected,
          participants,
          rekeyInfo,
          snippet,
          timestamp,
          unreadCount,
          ..._rowDerivedProps(rekeyInfo, unreadCount, isSelected),
        }
      }
    }
  },
  (dispatch) => ({
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  })
)

export {
  RowConnector,
}
