// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import {BigTeamChannel} from '.'
import {pausableConnect, createCachedSelector, type TypedState} from '../../../../util/container'

const getSelected = state => Constants.getSelectedConversation(state)
const getInbox = (state, conversationIDKey) => Constants.getInbox(state, conversationIDKey)
const passConversationIDKey = (_, conversationIDKey) => conversationIDKey
const getFinalizedInfo = (state, conversationIDKey) => state.chat.getIn(['finalizedState', conversationIDKey])
const getRekeyInfo = (state, conversationIDKey) => state.chat.getIn(['rekeyInfos', conversationIDKey])
const getUnreadTotals = (state, conversationIDKey) =>
  state.entities.getIn(['inboxUnreadCountTotal', conversationIDKey], 0)
const getUnreadBadges = (state, conversationIDKey) =>
  state.entities.getIn(['inboxUnreadCountBadge', conversationIDKey], 0)

const selector = createCachedSelector(
  [
    getInbox,
    getSelected,
    passConversationIDKey,
    getFinalizedInfo,
    getRekeyInfo,
    getUnreadTotals,
    getUnreadBadges,
  ],
  (inbox, selected, conversationIDKey, finalizeInfo, rekeyInfo, unreadTotal, unreadBadge) => {
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
    return {
      hasBadge,
      hasUnread,
      isMuted,
      isSelected,
      showBold,
    }
  }
)(passConversationIDKey)

const mapStateToProps = (state: TypedState, {conversationIDKey, channelname}) => ({
  ...selector(state, conversationIDKey),
  channelname,
})

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Creators.setInboxFilter(''))
    dispatch(Creators.selectConversation(conversationIDKey, true))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps.channelname,
  hasBadge: stateProps.hasBadge,
  hasUnread: stateProps.hasUnread,
  isActiveRoute: ownProps.isActiveRoute,
  isMuted: stateProps.isMuted,
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
  showBold: stateProps.showBold,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamChannel)
