// @flow
import * as Constants from '../../../constants/chat'
import * as I from 'immutable'
import {BigTeamHeaderRow, BigTeamChannelRow, BigTeamChannelFilteredRow} from './big-team-rows'
import {SmallTeamRow, SmallTeamFilteredRow} from './small-team-rows'
import {compose, renderComponent, branch, renderNothing} from 'recompose'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {formatTimeForConversationList} from '../../../util/timestamp'
import {globalColors} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {navigateAppend} from '../../../actions/route-tree'
import {pausableConnect, type TypedState} from '../../../util/container'
import {selectConversation, setInboxFilter} from '../../../actions/chat/creators'

function _rowDerivedProps(rekeyInfo, finalizeInfo, unreadCount: Constants.UnreadCounts, isError, isSelected) {
  // Derived props

  // If it's finalized we don't show the rekey as they can't solve it themselves
  const youNeedToRekey =
    !finalizeInfo && rekeyInfo && !rekeyInfo.get('rekeyParticipants').count() && rekeyInfo.get('youCanRekey')
  const participantNeedToRekey = !finalizeInfo && rekeyInfo && !!rekeyInfo.get('rekeyParticipants').count()

  const hasUnread = !participantNeedToRekey && !youNeedToRekey && (unreadCount && unreadCount.total > 0)
  const hasBadge = hasUnread && unreadCount.badged > 0
  const subColor = isError
    ? globalColors.red
    : isSelected ? globalColors.white : hasUnread ? globalColors.black_75 : globalColors.black_40
  const showBold = !isSelected && hasUnread
  const bgPlatform = isMobile ? globalColors.white : globalColors.blue5
  const backgroundColor = isSelected ? globalColors.blue : bgPlatform
  const usernameColor = isSelected ? globalColors.white : globalColors.darkBlue

  return {
    backgroundColor,
    hasUnread,
    participantNeedToRekey,
    showBold,
    subColor,
    usernameColor,
    youNeedToRekey,
    hasBadge,
  }
}

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)
const getYou = state => state.config.username || ''
const makeGetConversation = conversationIDKey => state =>
  state.chat.get('inbox').find(i => i.get('conversationIDKey') === conversationIDKey)
const makeGetSnippet = conversationIDKey => state => Constants.getSnippet(state, conversationIDKey)
const makeGetIsSelected = conversationIDKey => state =>
  Constants.newestConversationIDKey(Constants.getSelectedConversation(state), state.chat) ===
  conversationIDKey
const makeGetRekeyInfo = conversationIDKey => state => state.chat.get('rekeyInfos').get(conversationIDKey)
const makeGetUnreadCounts = conversationIDKey => state =>
  state.chat.get('conversationUnreadCounts').get(conversationIDKey)
const makeGetParticipants = conversationIDKey => state =>
  Constants.participantFilter(
    state.chat.get('pendingConversations').get(conversationIDKey) || I.List(),
    state.config.username || ''
  )
const getNowOverride = state => state.chat.get('nowOverride')
const makeGetFinalizedInfo = conversationIDKey => state =>
  state.chat.get('finalizedState').get(conversationIDKey)

const makeSelector = conversationIDKey => {
  const isPending = Constants.isPendingConversationIDKey(conversationIDKey)
  const blankUnreadCounts: Constants.UnreadCounts = {total: 0, badged: 0}
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
        timestamp: formatTimeForConversationList(Date.now(), nowOverride),
        unreadCount: blankUnreadCounts,
        ..._rowDerivedProps(null, null, blankUnreadCounts, false, isSelected),
      })
    )
  } else {
    return createImmutableEqualSelector(
      [
        makeGetConversation(conversationIDKey),
        makeGetSnippet(conversationIDKey),
        makeGetIsSelected(conversationIDKey),
        makeGetUnreadCounts(conversationIDKey),
        getYou,
        makeGetRekeyInfo(conversationIDKey),
        getNowOverride,
        makeGetFinalizedInfo(conversationIDKey),
      ],
      (conversation, snippet, isSelected, unreadCount, you, rekeyInfo, nowOverride, finalizeInfo) => {
        const isError = conversation.get('state') === 'error'
        const isMuted = conversation.get('status') === 'muted'
        const participants = Constants.participantFilter(conversation.get('participants'), you)
        const timestamp = formatTimeForConversationList(conversation.get('time'), nowOverride)
        const channelname = conversation.get('channelname')
        const teamname = conversation.get('teamname')
        return {
          channelname,
          conversationIDKey,
          isError,
          isMuted,
          isSelected,
          participants,
          rekeyInfo,
          snippet,
          teamname,
          timestamp,
          unreadCount: unreadCount || blankUnreadCounts,
          ..._rowDerivedProps(rekeyInfo, finalizeInfo, unreadCount, isError, isSelected),
        }
      }
    )
  }
}

const isSmallOrBig = type => ['small', 'big'].includes(type)

const mapStateToProps = (state: TypedState, {conversationIDKey, teamname, channelname, type}) => {
  if (isSmallOrBig(type)) {
    const selector = makeSelector(conversationIDKey)
    return (state: TypedState) => selector(state)
  } else {
    return {teamname, conversationIDKey}
  }
}

const mapDispatchToProps = dispatch => ({
  _onSelectConversation: (key: Constants.ConversationIDKey) => {
    dispatch(setInboxFilter(''))
    dispatch(selectConversation(key, true))
  },
  _onShowMenu: (teamname: string) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...stateProps,
  onSelectConversation: () => dispatchProps._onSelectConversation(stateProps.conversationIDKey),
  onShowMenu: () => dispatchProps._onShowMenu(stateProps.teamname),
})

const ConnectedRow = compose(
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(
    ({participants, type}) => isSmallOrBig(type) && (!participants || participants.isEmpty() === 0),
    renderNothing
  ),
  branch(props => props.filtered && props.type === 'small', renderComponent(SmallTeamFilteredRow)),
  branch(props => props.filtered && props.type === 'big', renderComponent(BigTeamChannelFilteredRow)),
  branch(props => props.type === 'bigHeader', renderComponent(BigTeamHeaderRow)),
  branch(props => props.type === 'big', renderComponent(BigTeamChannelRow))
)(SmallTeamRow)

export default ConnectedRow
