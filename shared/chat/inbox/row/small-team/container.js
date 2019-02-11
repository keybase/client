// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'
import {connect, isMobile} from '../../../../util/container'

type OwnProps = {|conversationIDKey: Types.ConversationIDKey|}

const mapStateToProps = (state, ownProps: OwnProps) => {
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
    isSelected: !isMobile && Constants.getSelectedConversation(state) === _conversationIDKey,
    isTypingSnippet,
    snippet,
    snippetDecoration: _meta.snippetDecoration,
    youAreReset,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => ({
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSmall'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const hasUnread = stateProps.hasUnread
  const styles = Constants.getRowStyles(stateProps._meta, isSelected, hasUnread)
  const participantNeedToRekey = stateProps._meta.rekeyers.size > 0
  const youNeedToRekey = !participantNeedToRekey && stateProps._meta.rekeyers.has(stateProps._username)

  return {
    backgroundColor: styles.backgroundColor,
    hasBadge: stateProps.hasBadge,
    hasResetUsers: !stateProps._meta.resetParticipants.isEmpty(),
    hasUnread,
    iconHoverColor: styles.iconHoverColor,
    isDecryptingSnippet:
      (hasUnread || stateProps._meta.snippet.length === 0) && Constants.isDecryptingSnippet(stateProps._meta),
    isFinalized: !!stateProps._meta.wasFinalizedBy,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    isTypingSnippet: stateProps.isTypingSnippet,
    // Don't allow you to select yourself
    onSelectConversation: isSelected ? () => {} : dispatchProps.onSelectConversation,
    participantNeedToRekey,
    participants: Constants.getRowParticipants(stateProps._meta, stateProps._username).toArray(),
    showBold: styles.showBold,
    snippet: stateProps.snippet,
    snippetDecoration: stateProps.snippetDecoration,
    subColor: styles.subColor,
    teamname: stateProps._meta.teamname,
    timestamp: Constants.timestampToString(stateProps._meta),
    usernameColor: styles.usernameColor,
    youAreReset: stateProps.youAreReset,
    youNeedToRekey,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SmallTeam)
