import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'
import * as Container from '../../../../util/container'
import type {AllowedColors} from '../../../../common-adapters/text'
import {formatTimeForConversationList} from '../../../../util/timestamp'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isTeam: boolean
  navKey: string
  name: string
  selected: boolean
  snippet?: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
  time: number
}

export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const conversationIDKey = ownProps.conversationIDKey
    const _meta = Constants.getMeta(state, conversationIDKey)
    const isEmptyMeta = _meta.conversationIDKey !== conversationIDKey
    const youAreReset = _meta.membershipType === 'youAreReset'
    const typers = state.chat2.typingMap.get(conversationIDKey)
    let snippet = state.chat2.metaMap.get(conversationIDKey) ? _meta.snippetDecorated : ownProps.snippet || ''
    // valid meta or empty?
    const snippetDecoration = isEmptyMeta ? ownProps.snippetDecoration : _meta.snippetDecoration
    let isTypingSnippet = false
    if (typers && typers.size > 0) {
      isTypingSnippet = true
      snippet =
        typers.size === 1
          ? `${typers.values().next().value as string} is typing...`
          : 'Multiple people typing...'
    }
    const _participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const participantNeedToRekey = _meta.rekeyers.size > 0
    const _username = state.config.username
    const hasUnread = Constants.getHasUnread(state, conversationIDKey)
    const isDecryptingSnippet =
      (hasUnread || snippet.length === 0) && Constants.isDecryptingSnippet(_meta.trustedState) && isEmptyMeta

    const teamname = _meta.teamname ? _meta.teamname : ownProps.isTeam ? ownProps.name : ''
    const timestamp = _meta.timestamp > 0 ? _meta.timestamp : ownProps.time || 0

    return {
      _draft: Constants.getDraft(state, conversationIDKey),
      _participantInfo,
      _username,
      conversationIDKey,
      hasBadge: Constants.getHasBadge(state, conversationIDKey),
      hasResetUsers: _meta.resetParticipants.size !== 0,
      hasUnread,
      isDecryptingSnippet,
      isFinalized: !!_meta.wasFinalizedBy,
      isMuted: Constants.isMuted(state, conversationIDKey),
      isSelected: ownProps.selected,
      isTypingSnippet,
      participantNeedToRekey,
      snippet,
      snippetDecoration,
      teamname,
      timestamp,
      youAreReset,
      youNeedToRekey: !participantNeedToRekey && _meta.rekeyers.has(_username),
    }
  },
  (dispatch: Container.TypedDispatch, {conversationIDKey}: OwnProps) => ({
    onHideConversation: () => dispatch(Chat2Gen.createHideConversation({conversationIDKey})),
    onMuteConversation: (muted: boolean) =>
      dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted})),
    onSelectConversation: () =>
      dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxSmall'})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const isSelected = stateProps.isSelected
    const hasUnread = stateProps.hasUnread
    const styles = Constants.getRowStyles(isSelected, hasUnread)
    const {hasResetUsers, isDecryptingSnippet, teamname, timestamp} = stateProps
    const {participantNeedToRekey, youNeedToRekey, conversationIDKey, isFinalized} = stateProps
    const participantsArray = stateProps._participantInfo.all.length
      ? Constants.getRowParticipants(stateProps._participantInfo, stateProps._username)
      : !ownProps.isTeam
      ? ownProps.name.split(',')
      : [ownProps.name]

    const participants = participantsArray

    return {
      backgroundColor: styles.backgroundColor,
      channelname: undefined,
      conversationIDKey,
      draft:
        stateProps._draft && !stateProps.isSelected && !stateProps.hasUnread ? stateProps._draft : undefined,
      hasBadge: stateProps.hasBadge,
      hasBottomLine:
        stateProps.youAreReset ||
        participantNeedToRekey ||
        isDecryptingSnippet ||
        !!stateProps.snippet ||
        youNeedToRekey ||
        hasResetUsers,
      hasResetUsers,
      hasUnread,
      iconHoverColor: styles.iconHoverColor,
      isDecryptingSnippet,
      isFinalized,
      isInWidget: false,
      isMuted: stateProps.isMuted,
      isSelected,
      isTypingSnippet: stateProps.isTypingSnippet,
      layoutIsTeam: ownProps.isTeam,
      layoutName: ownProps.name,
      layoutSnippet: ownProps.snippet,
      layoutSnippetDecoration: ownProps.snippetDecoration,
      onHideConversation: dispatchProps.onHideConversation,
      onMuteConversation: dispatchProps.onMuteConversation,
      // Don't allow you to select yourself
      onSelectConversation: isSelected ? undefined : dispatchProps.onSelectConversation,
      participantNeedToRekey,
      participants,
      showBold: styles.showBold,
      snippet: stateProps.snippet,
      snippetDecoration: stateProps.snippetDecoration,
      subColor: styles.subColor as AllowedColors,
      teamname,
      timestamp: formatTimeForConversationList(timestamp),
      usernameColor: styles.usernameColor,
      youAreReset: stateProps.youAreReset,
      youNeedToRekey,
    }
  }
)(SmallTeam)
