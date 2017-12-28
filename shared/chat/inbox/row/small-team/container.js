// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ChatGen from '../../../../actions/chat-gen'
import * as Constants from '../../../../constants/chat'
import * as Constants2 from '../../../../constants/chat2'
import * as I from 'immutable'
import * as Selectors from '../selectors'
import * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'
import {globalColors, isMobile} from '../../../../styles'
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
    ? Selectors.pendingSnippetRowSelector(state, conversationIDKey)
    : Selectors.snippetRowSelector(state, conversationIDKey)

  const meta = state.chat2.metaMap.get(conversationIDKey, emptyMeta)
  const hasBadge = state.chat2.badgeMap.get(conversationIDKey, 0) > 0
  const hasUnread = state.chat2.unreadMap.get(conversationIDKey, 0) > 0

  return {
    _meta: meta,
    _username: state.config.username,
    hasBadge,
    hasResetUsers: state.chat.inboxResetParticipants.get(conversationIDKey || '', I.Set()).size > 0,
    hasUnread,
    isActiveRoute,
    isSelected: p.isSelected,
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
    dispatch(ChatGen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
})

const bgPlatform = isMobile ? globalColors.white : globalColors.blue5

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const isError = stateProps._meta.trustedState === 'error'
  const hasUnread = stateProps.hasUnread
  const backgroundColor = isSelected ? globalColors.blue : bgPlatform
  const showBold = !isSelected && hasUnread
  const subColor = isError
    ? globalColors.red
    : isSelected ? globalColors.white : hasUnread ? globalColors.black_75 : globalColors.black_40
  const usernameColor = isSelected ? globalColors.white : globalColors.darkBlue
  const username = stateProps._username
  const participants = stateProps._meta.participants
    .toList()
    // Filter out ourselves unless its our 1:1 conversation
    .filter((participant, idx, list) => (list.size === 1 ? true : participant !== username))

  return {
    backgroundColor,
    hasBadge: stateProps.hasBadge,
    hasResetUsers: stateProps.hasResetUsers,
    hasUnread,
    isActiveRoute: ownProps.isActiveRoute,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    participantNeedToRekey: stateProps.participantNeedToRekey,
    participants,
    showBold,
    snippet: stateProps.snippet,
    subColor,
    teamname: stateProps._meta.teamname,
    timestamp: stateProps.timestamp,
    usernameColor,
    youAreReset: stateProps.youAreReset,
    youNeedToRekey: stateProps.youNeedToRekey,
  }
}

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(SmallTeam)
