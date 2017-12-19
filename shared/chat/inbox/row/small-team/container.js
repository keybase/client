// @flow
import * as Selectors from '../selectors'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as ChatGen from '../../../../actions/chat-gen'
import {SmallTeam} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

const getSnippet = (state: TypedState, conversationIDKey: Types.ConversationIDKey) =>
  // Constants.getSnippet(state, conversationIDKey) // TEMP
  'state: ' + state.chat2.metaMap.getIn([conversationIDKey, 'loadingState'], 'untrusted')

const mapStateToProps = (state: TypedState, {conversationIDKey, isActiveRoute}) => {
  const isPending = Constants.isPendingConversationIDKey(conversationIDKey || '')
  const p = isPending
    ? Selectors.pendingSnippetRowSelector(state, conversationIDKey)
    : Selectors.snippetRowSelector(state, conversationIDKey)

  return {
    backgroundColor: p.backgroundColor,
    hasBadge: p.hasBadge,
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
    youNeedToRekey: p.youNeedToRekey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(ChatGen.createSetInboxFilter({filter: ''}))
    dispatch(ChatGen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  backgroundColor: stateProps.backgroundColor,
  hasBadge: stateProps.hasBadge,
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
  youNeedToRekey: stateProps.youNeedToRekey,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(SmallTeam)
