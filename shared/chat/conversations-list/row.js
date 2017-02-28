// @flow
import * as I from 'immutable'
import {connect} from 'react-redux'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors} from '../../styles'
import {isPendingConversationIDKey, newestConversationIDKey, participantFilter, getSelectedConversation} from '../../constants/chat'
import {selectConversation} from '../../actions/chat'

import type {TypedState} from '../../constants/reducer'
import type {ConversationIDKey} from '../../constants/chat'

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
const getYou = state => state.config.username || ''
const makeGetConversation = conversationIDKey => state => state.chat.get('inbox').find(i => i.get('conversationIDKey') === conversationIDKey)
const makeGetIsSelected = conversationIDKey => state => newestConversationIDKey(getSelectedConversation(state), state.chat) === conversationIDKey
const makeGetRekeyInfo = conversationIDKey => state => state.chat.get('rekeyInfos').get(conversationIDKey)
const makeGetUnreadCounts = conversationIDKey => state => state.chat.get('conversationUnreadCounts').get(conversationIDKey)
const makeGetParticipants = conversationIDKey => state => (
  participantFilter(state.chat.get('pendingConversations').get(conversationIDKey), state.config.username || '')
)

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
