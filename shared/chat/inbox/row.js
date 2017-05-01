// @flow
import * as I from 'immutable'
import {connect} from 'react-redux'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors} from '../../styles'
import {isPendingConversationIDKey, newestConversationIDKey, participantFilter, getSelectedConversation} from '../../constants/chat'
import {selectConversation} from '../../actions/chat/creators'

import type {TypedState} from '../../constants/reducer'
import type {ConversationIDKey} from '../../constants/chat'

function _rowDerivedProps (rekeyInfo, finalizeInfo, unreadCount, isSelected) {
  // Derived props

  // If it's finalized we don't show the rekey as they can't solve it themselves
  const youNeedToRekey = !finalizeInfo && rekeyInfo && !rekeyInfo.get('rekeyParticipants').count() && rekeyInfo.get('youCanRekey')
  const participantNeedToRekey = !finalizeInfo && rekeyInfo && !!rekeyInfo.get('rekeyParticipants').count()

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
const getNowOverride = state => state.chat.get('nowOverride')
const makeGetFinalizedInfo = conversationIDKey => state => state.chat.get('finalizedState').get(conversationIDKey)

const makeSelector = (conversationIDKey) => {
  const isPending = isPendingConversationIDKey(conversationIDKey)
  if (isPending) {
    return createImmutableEqualSelector(
      [makeGetIsSelected(conversationIDKey), makeGetParticipants(conversationIDKey), getNowOverride],
      (isSelected, participants, nowOverride) => ({
        conversationIDKey,
        isMuted: false,
        isSelected,
        participants,
        rekeyInfo: null,
        snippet: '',
        timestamp: formatTimeForConversationList(Date.now(), nowOverride),
        unreadCount: 0,
        ..._rowDerivedProps(null, null, 0, isSelected),
      })
    )
  } else {
    return createImmutableEqualSelector(
      [makeGetConversation(conversationIDKey), makeGetIsSelected(conversationIDKey), makeGetUnreadCounts(conversationIDKey), getYou, makeGetRekeyInfo(conversationIDKey), getNowOverride, makeGetFinalizedInfo(conversationIDKey)],
      (conversation, isSelected, unreadCount, you, rekeyInfo, nowOverride, finalizeInfo) => ({
        conversationIDKey,
        isMuted: conversation.get('status') === 'muted',
        isSelected,
        participants: participantFilter(conversation.get('participants'), you),
        rekeyInfo,
        snippet: conversation.get('snippet'),
        timestamp: formatTimeForConversationList(conversation.get('time'), nowOverride),
        unreadCount: unreadCount || 0,
        ..._rowDerivedProps(rekeyInfo, finalizeInfo, unreadCount, isSelected),
      })
    )
  }
}

// $FlowIssue
const RowConnector = connect(
  (state: TypedState, {conversationIDKey}) => {
    const selector = makeSelector(conversationIDKey)
    return (state: TypedState) => selector(state)
  },
  (dispatch) => ({
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  })
)

export {
  RowConnector,
}
