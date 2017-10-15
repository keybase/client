// @flow
import * as Constants from '../../../constants/chat'
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
    const participantNeedToRekey = !finalizeInfo && rekeyInfo && !!rekeyInfo.get('rekeyParticipants').count()
    const youNeedToRekey =
      !finalizeInfo &&
      rekeyInfo &&
      !rekeyInfo.get('rekeyParticipants').count() &&
      rekeyInfo.get('youCanRekey')
    const hasUnread = !participantNeedToRekey && !youNeedToRekey && unreadTotal > 0
    const isSelected = selected === conversationIDKey
    const showBold = !isSelected && hasUnread
    const hasBadge = hasUnread && unreadBadge > 0
    const isMuted = inbox.get('status') === 'muted'
    const bgPlatform = isMobile ? globalColors.white : globalColors.blue5
    const backgroundColor = isSelected ? globalColors.blue : bgPlatform
    const usernameColor = isSelected ? globalColors.white : globalColors.darkBlue
    const isError = untrustedState.get(conversationIDKey) === 'error'
    const subColor = isError
      ? globalColors.red
      : isSelected ? globalColors.white : hasUnread ? globalColors.black_75 : globalColors.black_40
    // TODO avoid doing this filtering here cuase it makes a new one eaach time
    const participants = Constants.participantFilter(inbox.get('participants'), you)
    const timestamp = formatTimeForConversationList(inbox.get('time'), nowOverride)
    // TODO some stuff only for small team

    return {
      backgroundColor,
      hasBadge,
      hasUnread,
      isMuted,
      isSelected,
      participantNeedToRekey,
      participants,
      showBold,
      subColor,
      timestamp,
      usernameColor,
      youNeedToRekey,
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
  snippetRowSelector,
}
