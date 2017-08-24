// @flow
import * as I from 'immutable'
import pausableConnect from '../../../util/pausable-connect'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {formatTimeForConversationList} from '../../../util/timestamp'
import {globalColors} from '../../../styles'
import {
  isPendingConversationIDKey,
  newestConversationIDKey,
  participantFilter,
  getSelectedConversation,
} from '../../../constants/chat'
import {selectConversation, setInboxFilter} from '../../../actions/chat/creators'
import {SmallTeamRow, SmallTeamFilteredRow} from './small-team-rows'
import {BigTeamHeaderRow, BigTeamChannelRow, BigTeamChannelFilteredRow} from './big-team-rows'
import {compose, renderComponent, branch} from 'recompose'
import {navigateAppend} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'
import type {ConversationIDKey} from '../../../constants/chat'

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
  const usernameColor = isSelected ? globalColors.white : globalColors.darkBlue

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
          unreadCount: unreadCount || 0,
          ..._rowDerivedProps(rekeyInfo, finalizeInfo, unreadCount, isError, isSelected),
        }
      }
    )
  }
}

const mapStateToProps = (state: TypedState, {conversationIDKey, teamname, channelname, type}) => {
  if (['small', 'big'].includes(type)) {
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
  ...dispatchProps,
  onSelectConversation: () => dispatchProps._onSelectConversation(stateProps.conversationIDKey),
  onShowMenu: () => dispatchProps._onShowMenu(stateProps.teamname),
})

const ConnectedRow = compose(
  // $FlowIssue
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => props.filtered && props.type === 'small', renderComponent(SmallTeamFilteredRow)),
  branch(props => props.filtered && props.type === 'big', renderComponent(BigTeamChannelFilteredRow)),
  branch(props => props.type === 'bigHeader', renderComponent(BigTeamHeaderRow)),
  branch(props => props.type === 'big', renderComponent(BigTeamChannelRow))
)(SmallTeamRow)

export default ConnectedRow
