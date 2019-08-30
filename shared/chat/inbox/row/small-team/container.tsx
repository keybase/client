import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'
import * as Container from '../../../../util/container'
import {AllowedColors} from '../../../../common-adapters/text'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const _conversationIDKey = ownProps.conversationIDKey
  const _meta = Constants.getMeta(state, _conversationIDKey)
  const youAreReset = _meta.membershipType === 'youAreReset'
  const typers = state.chat2.typingMap.get(_conversationIDKey)
  let snippet = _meta.snippet
  let isTypingSnippet = false
  if (typers && typers.size > 0) {
    isTypingSnippet = true
    snippet = typers.size === 1 ? `${typers.first()} is typing...` : 'Multiple people typing...'
  }
  return {
    _meta,
    _username: state.config.username || '',
    hasBadge: Constants.getHasBadge(state, _conversationIDKey),
    hasUnread: Constants.getHasUnread(state, _conversationIDKey),
    isSelected: !Container.isMobile && Constants.getSelectedConversation(state) === _conversationIDKey,
    isTypingSnippet,
    snippet,
    snippetDecoration: _meta.snippetDecoration,
    youAreReset,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {conversationIDKey}: OwnProps) => ({
  onHideConversation: () => dispatch(Chat2Gen.createHideConversation({conversationIDKey})),
  onMuteConversation: (isMuted: boolean) =>
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: !isMuted})),
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSmall'})),
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    const isSelected = stateProps.isSelected
    const hasUnread = stateProps.hasUnread
    const styles = Constants.getRowStyles(stateProps._meta, isSelected, hasUnread)
    const participantNeedToRekey = stateProps._meta.rekeyers.size > 0
    const youNeedToRekey = !participantNeedToRekey && stateProps._meta.rekeyers.has(stateProps._username)
    const isDecryptingSnippet =
      (hasUnread || stateProps._meta.snippet.length === 0) && Constants.isDecryptingSnippet(stateProps._meta)
    const hasResetUsers = !stateProps._meta.resetParticipants.isEmpty()

    return {
      backgroundColor: styles.backgroundColor,
      channelname: undefined,
      conversationIDKey: stateProps._meta.conversationIDKey,
      draft:
        stateProps._meta.draft && !stateProps.isSelected && !stateProps.hasUnread
          ? stateProps._meta.draft
          : undefined,
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
      isFinalized: !!stateProps._meta.wasFinalizedBy,
      isInWidget: false,
      isMuted: stateProps._meta.isMuted,
      isSelected,
      isTypingSnippet: stateProps.isTypingSnippet,
      onHideConversation: dispatchProps.onHideConversation,
      onMuteConversation: () => dispatchProps.onMuteConversation(stateProps._meta.isMuted),
      // Don't allow you to select yourself
      onSelectConversation: isSelected ? () => {} : dispatchProps.onSelectConversation,
      participantNeedToRekey,
      participants: Constants.getRowParticipants(stateProps._meta, stateProps._username).toArray(),
      showBold: styles.showBold,
      snippet: stateProps.snippet,
      snippetDecoration: stateProps.snippetDecoration,
      subColor: styles.subColor as AllowedColors,
      teamname: stateProps._meta.teamname,
      timestamp: Constants.timestampToString(stateProps._meta),
      usernameColor: styles.usernameColor,
      youAreReset: stateProps.youAreReset,
      youNeedToRekey,
    }
  },
  'SmallTeam'
)(SmallTeam)
