// @flow
import * as Constants from '../../../constants/chat'
import * as I from 'immutable'
import {BigTeamChannelFilteredRow} from './big-team-rows'
import {SmallTeamRow, SmallTeamFilteredRow} from './small-team-rows'
import {compose, renderComponent, branch, renderNothing} from 'recompose'
import {formatTimeForConversationList} from '../../../util/timestamp'
import {globalColors} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {navigateAppend} from '../../../actions/route-tree'
import {pausableConnect, createImmutableEqualSelector, type TypedState} from '../../../util/container'
import {selectConversation, setInboxFilter} from '../../../actions/chat/creators'

function _rowDerivedProps(
  rekeyInfo,
  finalizeInfo,
  unreadTotal: number,
  unreadBadge: number,
  isError,
  isSelected
) {
  // Derived props

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

const getYou = state => state.config.username || ''
// TODO use rereselect instead
// TODO analyze the reselect tree
const makeGetConversation = conversationIDKey => state => Constants.getInbox(state, conversationIDKey)
const makeGetSnippet = conversationIDKey => state => Constants.getSnippet(state, conversationIDKey)
const makeGetIsSelected = conversationIDKey => state =>
  Constants.newestConversationIDKey(Constants.getSelectedConversation(state), state.chat) ===
  conversationIDKey
const makeGetRekeyInfo = conversationIDKey => state => state.chat.get('rekeyInfos').get(conversationIDKey)
const makeGetUnreadTotals = conversationIDKey => state =>
  state.entities.getIn(['inboxUnreadCountTotal', conversationIDKey], 0)
const makeGetUnreadBadges = conversationIDKey => state =>
  state.entities.getIn(['inboxUnreadCountBadge', conversationIDKey], 0)
const makeGetParticipants = conversationIDKey => state =>
  Constants.participantFilter(
    state.chat.get('pendingConversations').get(conversationIDKey) || I.List(),
    state.config.username || ''
  )
const getNowOverride = state => state.chat.nowOverride
const makeGetFinalizedInfo = conversationIDKey => state =>
  state.chat.getIn(['finalizedState', conversationIDKey])
const getUntrustedState = state => state.entities.inboxUntrustedState

const makeSelector = conversationIDKey => {
  const isPending = Constants.isPendingConversationIDKey(conversationIDKey)
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
        unreadBadges: 0,
        unreadTotal: 0,
        ..._rowDerivedProps(null, null, 0, 0, false, isSelected),
      })
    )
  } else {
    return createImmutableEqualSelector(
      [
        makeGetConversation(conversationIDKey),
        makeGetSnippet(conversationIDKey),
        makeGetIsSelected(conversationIDKey),
        makeGetUnreadTotals(conversationIDKey),
        makeGetUnreadBadges(conversationIDKey),
        getYou,
        makeGetRekeyInfo(conversationIDKey),
        getNowOverride,
        makeGetFinalizedInfo(conversationIDKey),
        getUntrustedState,
      ],
      (
        conversation,
        snippet,
        isSelected,
        unreadTotal,
        unreadBadge,
        you,
        rekeyInfo,
        nowOverride,
        finalizeInfo,
        untrustedState
      ) => {
        if (!conversation) {
          return {type: 'Invalid row'}
        }
        const isError = untrustedState.get(conversationIDKey) === 'error'
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
          unreadTotal,
          unreadBadge,
          ..._rowDerivedProps(rekeyInfo, finalizeInfo, unreadTotal, unreadBadge, isError, isSelected),
        }
      }
    )
  }
}

const isSmallOrBig = type => ['small', 'big'].includes(type)

const mapStateToProps = (state: TypedState, {conversationIDKey, teamname, channelname, type}) => {
  return {type: 'Invalid row'}
  // if (isSmallOrBig(type)) {
  // const selector = makeSelector(conversationIDKey)
  // return (state: TypedState) => selector(state)
  // } else {
  // return {teamname, conversationIDKey}
  // }
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
  // $FlowIssue doesn't understand stateProps
  onSelectConversation: () => dispatchProps._onSelectConversation(stateProps.conversationIDKey),
  // $FlowIssue doesn't understand stateProps
  onShowMenu: () => dispatchProps._onShowMenu(stateProps.teamname),
})

const ConnectedRow = compose(
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => props.type === 'Invalid row', renderNothing),
  branch(
    ({participants, type}) => isSmallOrBig(type) && (!participants || participants.isEmpty() === 0),
    renderNothing
  ),
  branch(props => props.filtered && props.type === 'small', renderComponent(SmallTeamFilteredRow)),
  branch(props => props.filtered && props.type === 'big', renderComponent(BigTeamChannelFilteredRow))
)(SmallTeamRow)

export default ConnectedRow
