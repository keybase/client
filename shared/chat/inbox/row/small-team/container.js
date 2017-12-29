// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat'
import * as Constants2 from '../../../../constants/chat2'
import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'
import * as util from '../util'
import {SmallTeam} from '.'
import {pausableConnect, type TypedState, type Dispatch} from '../../../../util/container'

const emptyMeta = Constants2.makeConversationMeta()

type OwnProps = {conversationIDKey: ?Types.ConversationIDKey, isActiveRoute: boolean}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey || ''
  const {isActiveRoute} = ownProps
  const isPending = Constants.isPendingConversationIDKey(conversationIDKey)
  const youAreReset = Constants.isResetConversationIDKey(state, conversationIDKey)

  // TODO remove
  const p = isPending
    ? util.pendingSnippetRowSelector(state, conversationIDKey)
    : util.snippetRowSelector(state, conversationIDKey)

  return {
    _meta: (conversationIDKey && Constants2.getMeta(state, conversationIDKey)) || emptyMeta,
    _username: state.config.username || '',
    hasBadge: Constants2.getHasBadge(state, conversationIDKey),
    hasResetUsers: state.chat.inboxResetParticipants.get(conversationIDKey || '', I.Set()).size > 0,
    hasUnread: Constants2.getHasUnread(state, conversationIDKey),
    isActiveRoute,
    isSelected: Constants2.getIsSelected(state, conversationIDKey),
    participantNeedToRekey: p.participantNeedToRekey,
    snippet: Constants2.getSnippet(state, conversationIDKey),
    timestamp: p.timestamp,
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
    snippet: stateProps.snippet,
    subColor: derivedProps.subColor,
    teamname: stateProps._meta.teamname,
    timestamp: stateProps.timestamp,
    usernameColor: derivedProps.usernameColor,
    youAreReset: stateProps.youAreReset,
    youNeedToRekey: stateProps.youNeedToRekey,
  }
}

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(SmallTeam)
