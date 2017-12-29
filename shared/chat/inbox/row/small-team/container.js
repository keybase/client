// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat'
import * as Constants2 from '../../../../constants/chat2'
import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'
import * as util from '../util'
import {SmallTeam} from '.'
import {pausableConnect, type TypedState, type Dispatch} from '../../../../util/container'

type OwnProps = {conversationIDKey: ?Types.ConversationIDKey, isActiveRoute: boolean}
const emptyMeta = Constants2.makeConversationMeta()

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const _conversationIDKey = ownProps.conversationIDKey || ''
  const {isActiveRoute} = ownProps
  const isPending = Constants.isPendingConversationIDKey(_conversationIDKey)
  const youAreReset = Constants.isResetConversationIDKey(state, _conversationIDKey)

  // TODO remove
  const p = isPending
    ? util.pendingSnippetRowSelector(state, _conversationIDKey)
    : util.snippetRowSelector(state, _conversationIDKey)

  return {
    _conversationIDKey,
    _messageIDs: (_conversationIDKey && state.chat2.messageOrdinals.get(_conversationIDKey)) || I.List(),
    _messageMap: (_conversationIDKey && state.chat2.messageMap.get(_conversationIDKey)) || I.Map(),
    _meta: (_conversationIDKey && Constants2.getMeta(state, _conversationIDKey)) || emptyMeta,
    _username: state.config.username || '',
    hasBadge: Constants2.getHasBadge(state, _conversationIDKey),
    hasResetUsers: state.chat.inboxResetParticipants.get(_conversationIDKey || '', I.Set()).size > 0,
    hasUnread: Constants2.getHasUnread(state, _conversationIDKey),
    isActiveRoute,
    isSelected: Constants2.getIsSelected(state, _conversationIDKey),
    participantNeedToRekey: p.participantNeedToRekey,
    youAreReset,
    youNeedToRekey: p.youNeedToRekey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}: OwnProps) => ({
  onSelectConversation: () => {
    dispatch(Chat2Gen.createSetInboxFilter({filter: ''}))
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const hasUnread = stateProps.hasUnread
  const derivedProps = Constants2.getRowColors(stateProps._meta, isSelected, hasUnread)
  const snippetMessage = Constants2.getSnippetMessage(
    stateProps._messageMap,
    stateProps._messageIDs,
    stateProps._conversationIDKey
  )
  return {
    backgroundColor: derivedProps.backgroundColor,
    hasBadge: stateProps.hasBadge,
    hasResetUsers: stateProps.hasResetUsers,
    hasUnread,
    isActiveRoute: ownProps.isActiveRoute,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    participantNeedToRekey: stateProps.participantNeedToRekey,
    participants: Constants2.getRowParticipants(stateProps._meta, stateProps._username),
    showBold: derivedProps.showBold,
    snippet: Constants2.getSnippetText(snippetMessage),
    subColor: derivedProps.subColor,
    teamname: stateProps._meta.teamname,
    timestamp: Constants2.getSnippetTimestamp(snippetMessage),
    usernameColor: derivedProps.usernameColor,
    youAreReset: stateProps.youAreReset,
    youNeedToRekey: stateProps.youNeedToRekey,
  }
}

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(SmallTeam)
