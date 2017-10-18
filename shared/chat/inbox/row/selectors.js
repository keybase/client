// @flow
import * as Constants from '../../../constants/chat'
import * as I from 'immutable'
import {createCachedSelector, type TypedState} from '../../../util/container'
import {formatTimeForConversationList} from '../../../util/timestamp'
import {globalColors} from '../../../styles'
import {isMobile} from '../../../constants/platform'

const getSelected = (state: TypedState) => Constants.getSelectedConversation(state)
const getInbox = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) =>
  Constants.getInbox(state, conversationIDKey)
const passConversationIDKey = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) =>
  conversationIDKey
const getFinalizedInfo = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) =>
  state.chat.getIn(['finalizedState', conversationIDKey])
const getRekeyInfo = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) =>
  state.chat.getIn(['rekeyInfos', conversationIDKey])
const getUnreadTotals = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) =>
  state.entities.getIn(['inboxUnreadCountTotal', conversationIDKey], 0)
const getUnreadBadges = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) =>
  state.entities.getIn(['inboxUnreadCountBadge', conversationIDKey], 0)
const getYou = (state: TypedState) => state.config.username || ''
const getNowOverride = (state: TypedState) => state.chat.nowOverride
const getUntrustedState = (state: TypedState) => state.entities.inboxUntrustedState
const getPendingParticipants = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) =>
  state.chat.get('pendingConversations').get(conversationIDKey) || I.List()

function _commonDerivedProps(
  rekeyInfo,
  finalizeInfo,
  unreadTotal: number,
  unreadBadge: number,
  isError,
  isSelected
) {
  // If it's finalized we don't show the rekey as they can't solve it themselves
  const youNeedToRekey =
    !finalizeInfo && rekeyInfo && !rekeyInfo.get('rekeyParticipants').count() && rekeyInfo.get('youCanRekey')
  const participantNeedToRekey = !finalizeInfo && rekeyInfo && !!rekeyInfo.get('rekeyParticipants').count()

  const hasUnread = !participantNeedToRekey && !youNeedToRekey && unreadTotal > 0
  const hasBadge = hasUnread && unreadBadge > 0
  const subColor = isError
    ? globalColors.red
    : isSelected ? globalColors.white : hasUnread ? globalColors.black_75 : globalColors.black_40
  const showBold = !isSelected && hasUnread
  const bgPlatform = isMobile ? globalColors.white : globalColors.blue5
  const backgroundColor = isSelected ? globalColors.blue : bgPlatform
  const usernameColor = isSelected ? globalColors.white : globalColors.darkBlue

  return {
    backgroundColor,
    hasBadge,
    hasUnread,
    participantNeedToRekey,
    showBold,
    subColor,
    usernameColor,
    youNeedToRekey,
  }
}

// Used by rows that show snippets
const snippetRowSelector = createCachedSelector(
  [
    getInbox,
    getSelected,
    passConversationIDKey,
    getFinalizedInfo,
    getRekeyInfo,
    getUnreadTotals,
    getUnreadBadges,
    getYou,
    getNowOverride,
    getUntrustedState,
  ],
  (
    inbox,
    selected,
    conversationIDKey,
    finalizeInfo,
    rekeyInfo,
    unreadTotal,
    unreadBadge,
    you,
    nowOverride,
    untrustedState
  ) => {
    const isSelected = selected === conversationIDKey
    const isMuted = inbox && inbox.get('status') === 'muted'
    const isError = untrustedState.get(conversationIDKey) === 'error'
    const participants = inbox ? Constants.participantFilter(inbox.get('participants'), you) : I.List()
    const timestamp = inbox ? formatTimeForConversationList(inbox.get('time'), nowOverride) : ''
    const d = _commonDerivedProps(rekeyInfo, finalizeInfo, unreadTotal, unreadBadge, isError, isSelected)
    const teamname = inbox ? inbox.teamname : null

    return {
      backgroundColor: d.backgroundColor,
      hasBadge: d.hasBadge,
      hasUnread: d.hasUnread,
      isMuted,
      isSelected,
      participantNeedToRekey: d.participantNeedToRekey,
      participants,
      showBold: d.showBold,
      subColor: d.subColor,
      teamname,
      timestamp,
      usernameColor: d.usernameColor,
      youNeedToRekey: d.youNeedToRekey,
    }
  }
)(passConversationIDKey)

const pendingSnippetRowSelector = createCachedSelector(
  [getSelected, getPendingParticipants, getNowOverride, passConversationIDKey],
  (selected, participants, nowOverride, conversationIDKey) => {
    const isSelected = selected === conversationIDKey
    const isMuted = false
    const isError = false
    const timestamp = formatTimeForConversationList(Date.now(), nowOverride)
    const d = _commonDerivedProps(null, null, 0, 0, isError, isSelected)

    return {
      backgroundColor: d.backgroundColor,
      hasBadge: d.hasBadge,
      hasUnread: d.hasUnread,
      isMuted,
      isSelected,
      participantNeedToRekey: d.participantNeedToRekey,
      participants,
      showBold: d.showBold,
      subColor: d.subColor,
      timestamp,
      usernameColor: d.usernameColor,
      youNeedToRekey: d.youNeedToRekey,
    }
  }
)(passConversationIDKey)

export {
  getSelected,
  getInbox,
  passConversationIDKey,
  getFinalizedInfo,
  getRekeyInfo,
  getUnreadTotals,
  getUnreadBadges,
  pendingSnippetRowSelector,
  snippetRowSelector,
}
