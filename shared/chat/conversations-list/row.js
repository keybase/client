// @flow
import * as I from 'immutable'
import {chatTab} from '../../constants/tabs'
import {connect} from 'react-redux'
import {createSelectorCreator, defaultMemoize} from 'reselect'
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

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)
const makeGetIsSelected = conversationIDKey => state => newestConversationIDKey(_selectedSelector(state), state.chat) === conversationIDKey
const makeGetParticipants = conversationIDKey => state => {
  return participantFilter(
    state.chat.get('pendingConversations').get(conversationIDKey),
    state.config.username || ''
  )
}

const makeGetConversation = conversationIDKey => state => state.chat.get('inbox').find(i => i.get('conversationIDKey') === conversationIDKey)
const makeGetUnreadCounts = conversationIDKey => state => state.chat.get('conversationUnreadCounts').get(conversationIDKey)
const getYou = state => state.config.username || ''
const makeGetRekeyInfo = conversationIDKey => state => state.chat.get('rekeyInfos').get(conversationIDKey)

const makeSelector = (conversationIDKey, nowOverride) => {
  const isPending = isPendingConversationIDKey(conversationIDKey)
  if (isPending) {
    return createImmutableEqualSelector(
      [makeGetIsSelected(conversationIDKey), makeGetParticipants(conversationIDKey)],
      (isSelected, participants) => ({
        conversationIDKey,
        isMuted: false,
        isSelected,
        participants,
        rekeyInfo: null,
        snippet: '',
        timestamp: formatTimeForConversationList(Date.now(), nowOverride),
        unreadCount: 0,
        ..._rowDerivedProps(null, 0, isSelected),
      })
    )
  } else {
    const getConversation = createImmutableEqualSelector(
      [makeGetConversation(conversationIDKey)],
      conversation => conversation
    )

    return createImmutableEqualSelector(
      [getConversation, makeGetIsSelected(conversationIDKey), makeGetUnreadCounts(conversationIDKey), getYou, makeGetRekeyInfo(conversationIDKey)],
      (conversation, isSelected, unreadCount, you, rekeyInfo) => ({
        conversationIDKey,
        isMuted: conversation.get('muted'),
        isSelected,
        participants: participantFilter(conversation.get('participants'), you),
        rekeyInfo,
        snippet: conversation.get('snippet'),
        timestamp: formatTimeForConversationList(conversation.get('time'), nowOverride),
        unreadCount,
        ..._rowDerivedProps(rekeyInfo, unreadCount, isSelected),
      })
    )
  }
}

// $FlowIssue
const RowConnector = connect(
  (state: TypedState, {conversationIDKey, nowOverride}) => {
    const selector = makeSelector(conversationIDKey, nowOverride)
    return (state: TypedState) => selector(state)
  },
  (dispatch) => ({
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  })
)

export {
  RowConnector,
}
