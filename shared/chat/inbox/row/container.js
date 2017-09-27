// @flow
import * as I from 'immutable'
import pausableConnect from '../../../util/pausable-connect'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {formatTimeForConversationList} from '../../../util/timestamp'
import {globalColors} from '../../../styles'
import * as Constants from '../../../constants/chat'
import {selectConversation, setInboxFilter} from '../../../actions/chat/creators'
import {SmallTeamRow, SmallTeamFilteredRow} from './small-team-rows'
import {BigTeamHeaderRow, BigTeamChannelRow, BigTeamChannelFilteredRow} from './big-team-rows'
import {compose, renderComponent, branch, renderNothing} from 'recompose'
import {navigateAppend} from '../../../actions/route-tree'
import {isMobile} from '../../../constants/platform'

import type {TypedState} from '../../../constants/reducer'
import type {ConversationIDKey} from '../../../constants/chat'

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

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)
const getYou = state => state.config.username || ''
const makeGetConversation = conversationIDKey => state =>
  state.chat.get('inbox').find(i => i.get('conversationIDKey') === conversationIDKey)
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
const getNowOverride = state => state.chat.get('nowOverride')
const makeGetFinalizedInfo = conversationIDKey => state =>
  state.chat.get('finalizedState').get(conversationIDKey)

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
        finalizeInfo
      ) => {
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
  if (isSmallOrBig(type)) {
    const selector = makeSelector(conversationIDKey)
    return (state: TypedState) => selector(state)
  } else {
    return {teamname}
  }
}

const mapDispatchToProps = dispatch => ({
  _onSelectConversation: (key: ConversationIDKey) => {
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
  // $FlowIssue
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
