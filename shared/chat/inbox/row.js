// @flow
import * as I from 'immutable'
import {connect} from 'react-redux'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors} from '../../styles'
import {
  isPendingConversationIDKey,
  newestConversationIDKey,
  participantFilter,
  getSelectedConversation,
} from '../../constants/chat'
import {selectConversation} from '../../actions/chat/creators'

import type {TypedState} from '../../constants/reducer'
import type {ConversationIDKey} from '../../constants/chat'

function _rowDerivedProps(rekeyInfo, finalizeInfo, unreadCount, isError, isSelected) {
  // Derived props

  // If it's finalized we don't show the rekey as they can't solve it themselves
  const youNeedToRekey =
    !finalizeInfo && rekeyInfo && !rekeyInfo.get('rekeyParticipants').count() && rekeyInfo.get('youCanRekey')
  const participantNeedToRekey = !finalizeInfo && rekeyInfo && !!rekeyInfo.get('rekeyParticipants').count()

  const hasUnread = !participantNeedToRekey && !youNeedToRekey && !!unreadCount
  const subColor = isError
    ? globalColors.red
    : isSelected ? globalColors.white : hasUnread ? globalColors.black_75 : globalColors.black_40
  const showBold = !isSelected && hasUnread
  const backgroundColor = isSelected ? globalColors.blue : globalColors.white
  const marginRight = isSelected ? 0 : 1
  const usernameColor = isSelected ? globalColors.white : globalColors.darkBlue

  return {
    backgroundColor,
    hasUnread,
    marginRight,
    participantNeedToRekey,
    showBold,
    subColor,
    usernameColor,
    youNeedToRekey,
  }
}

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)
const getYou = state => state.config.username || ''
const makeGetConversation = conversationIDKey => state =>
  state.chat.get('inbox').find(i => i.get('conversationIDKey') === conversationIDKey)
const makeGetIsSelected = conversationIDKey => state =>
  newestConversationIDKey(getSelectedConversation(state), state.chat) === conversationIDKey
const makeGetRekeyInfo = conversationIDKey => state => state.chat.get('rekeyInfos').get(conversationIDKey)
const makeGetUnreadCounts = conversationIDKey => state =>
  state.chat.get('conversationUnreadCounts').get(conversationIDKey)
const makeGetParticipants = conversationIDKey => state =>
  participantFilter(
    state.chat.get('pendingConversations').get(conversationIDKey),
    state.config.username || ''
  )
const getNowOverride = state => state.chat.get('nowOverride')
const makeGetFinalizedInfo = conversationIDKey => state =>
  state.chat.get('finalizedState').get(conversationIDKey)

const makeSelector = conversationIDKey => {
  const isPending = isPendingConversationIDKey(conversationIDKey)
  if (isPending) {
    return createImmutableEqualSelector(
      [makeGetIsSelected(conversationIDKey), makeGetParticipants(conversationIDKey), getNowOverride],
      (isSelected, participants, nowOverride) => ({
        conversationIDKey,
        isError: false,
        isMuted: false,
        isSelected,
        participants,
        rekeyInfo: null,
        snippet: '',
        timestamp: formatTimeForConversationList(Date.now(), nowOverride),
        unreadCount: 0,
        ..._rowDerivedProps(null, null, 0, false, isSelected),
      })
    )
  } else {
    return createImmutableEqualSelector(
      [
        makeGetConversation(conversationIDKey),
        makeGetIsSelected(conversationIDKey),
        makeGetUnreadCounts(conversationIDKey),
        getYou,
        makeGetRekeyInfo(conversationIDKey),
        getNowOverride,
        makeGetFinalizedInfo(conversationIDKey),
      ],
      (conversation, isSelected, unreadCount, you, rekeyInfo, nowOverride, finalizeInfo) => {
        const isError = conversation.get('state') === 'error'
        const isMuted = conversation.get('status') === 'muted'
        const participants = participantFilter(conversation.get('participants'), you)
        const snippet = conversation.get('snippet')
        const timestamp = formatTimeForConversationList(conversation.get('time'), nowOverride)
        return {
          conversationIDKey,
          isError,
          isMuted,
          isSelected,
          participants,
          rekeyInfo,
          snippet,
          timestamp,
          unreadCount: unreadCount || 0,
          ..._rowDerivedProps(rekeyInfo, finalizeInfo, unreadCount, isError, isSelected),
        }
      }
    )
  }
}

// $FlowIssue
const RowConnector = connect(
  (state: TypedState, {conversationIDKey}) => {
    const selector = makeSelector(conversationIDKey)
    return (state: TypedState) => selector(state)
  },
  dispatch => ({
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  })
)

export {RowConnector}
