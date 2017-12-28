// @flow
import * as I from 'immutable'
import * as Selectors from '../selectors'
import * as Constants2 from '../../../../constants/chat2'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ChatGen from '../../../../actions/chat-gen'
import {SmallTeam} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

const getSnippet = (state: TypedState, conversationIDKey: Types.ConversationIDKey) =>
  Constants2.getSnippet(state, conversationIDKey)

const mapStateToProps = (state: TypedState, {conversationIDKey, isActiveRoute}) => {
  const isPending = Constants.isPendingConversationIDKey(conversationIDKey || '')
  const youAreReset = Constants.isResetConversationIDKey(state, conversationIDKey || '')

  const p = isPending
    ? Selectors.pendingSnippetRowSelector(state, conversationIDKey)
    : Selectors.snippetRowSelector(state, conversationIDKey)

  return {
    backgroundColor: p.backgroundColor,
    hasBadge: p.hasBadge,
    hasResetUsers: state.chat.inboxResetParticipants.get(conversationIDKey || '', I.Set()).size > 0,
    hasUnread: p.hasUnread,
    isActiveRoute,
    isMuted: p.isMuted,
    isSelected: p.isSelected,
    participantNeedToRekey: p.participantNeedToRekey,
    participants: p.participants,
    showBold: p.showBold,
    snippet: getSnippet(state, conversationIDKey || ''),
    subColor: p.subColor,
    teamname: p.teamname,
    timestamp: p.timestamp,
    usernameColor: p.usernameColor,
    youAreReset,
    youNeedToRekey: p.youNeedToRekey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Chat2Gen.createSetInboxFilter({filter: ''}))
    dispatch(ChatGen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  backgroundColor: stateProps.backgroundColor,
  hasBadge: stateProps.hasBadge,
  hasResetUsers: stateProps.hasResetUsers,
  hasUnread: stateProps.hasUnread,
  isActiveRoute: ownProps.isActiveRoute,
  isMuted: stateProps.isMuted,
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
  participantNeedToRekey: stateProps.participantNeedToRekey,
  participants: stateProps.participants,
  showBold: stateProps.showBold,
  snippet: stateProps.snippet,
  subColor: stateProps.subColor,
  teamname: stateProps.teamname || '',
  timestamp: stateProps.timestamp,
  usernameColor: stateProps.usernameColor,
  youAreReset: stateProps.youAreReset,
  youNeedToRekey: stateProps.youNeedToRekey,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(SmallTeam)
