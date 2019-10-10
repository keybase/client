import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'
import * as Container from '../../../../util/container'
import {AllowedColors} from '../../../../common-adapters/text'
import {formatTimeForConversationList} from '../../../../util/timestamp'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isTeam: boolean
  navKey: string
  name: string
  snippet?: string
  snippetDecoration?: string
  time: number
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const _conversationIDKey = ownProps.conversationIDKey
  const _meta = Constants.getMeta(state, _conversationIDKey)
  const youAreReset = _meta.membershipType === 'youAreReset'
  const typers = state.chat2.typingMap.get(_conversationIDKey)
  let snippet = _meta.snippet || ownProps.snippet || ''
  let snippetDecoration = _meta.snippetDecoration || ownProps.snippetDecoration || ''
  let isTypingSnippet = false
  if (typers && typers.size > 0) {
    isTypingSnippet = true
    snippet = typers.size === 1 ? `${typers.values().next().value} is typing...` : 'Multiple people typing...'
  }
  return {
    _draft: Constants.getDraft(state, _conversationIDKey),
    _meta,
    _username: state.config.username,
    hasBadge: Constants.getHasBadge(state, _conversationIDKey),
    hasUnread: Constants.getHasUnread(state, _conversationIDKey),
    isMuted: Constants.isMuted(state, _conversationIDKey),
    isSelected: !Container.isMobile && Constants.getSelectedConversation(state) === _conversationIDKey,
    isTypingSnippet,
    snippet,
    snippetDecoration,
    youAreReset,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {conversationIDKey, navKey}: OwnProps) => ({
  onHideConversation: () => dispatch(Chat2Gen.createHideConversation({conversationIDKey})),
  onMuteConversation: (isMuted: boolean) =>
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: !isMuted})),
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, navKey, reason: 'inboxSmall'})),
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const isSelected = stateProps.isSelected
    const hasUnread = stateProps.hasUnread
    const styles = Constants.getRowStyles(isSelected, hasUnread)
    const participantNeedToRekey = stateProps._meta.rekeyers.size > 0
    const youNeedToRekey = !participantNeedToRekey && stateProps._meta.rekeyers.has(stateProps._username)
    const isDecryptingSnippet =
      (hasUnread || stateProps.snippet.length === 0) && Constants.isDecryptingSnippet(stateProps._meta)
    const hasResetUsers = stateProps._meta.resetParticipants.size !== 0
    const participants = stateProps._meta.participants.length
      ? Constants.getRowParticipants(stateProps._meta, stateProps._username)
      : !ownProps.isTeam
      ? ownProps.name.split(',')
      : [ownProps.name]
    const teamname = stateProps._meta.teamname
      ? stateProps._meta.teamname
      : ownProps.isTeam
      ? ownProps.name
      : ''
    const timestamp = stateProps._meta.timestamp > 0 ? stateProps._meta.timestamp : ownProps.time || 0
    return {
      backgroundColor: styles.backgroundColor,
      channelname: undefined,
      conversationIDKey: stateProps._meta.conversationIDKey,
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
      isFinalized: !!stateProps._meta.wasFinalizedBy,
      isInWidget: false,
      isMuted: stateProps.isMuted,
      isSelected,
      isTypingSnippet: stateProps.isTypingSnippet,
      layoutIsTeam: ownProps.isTeam,
      layoutName: ownProps.name,
      layoutSnippet: ownProps.snippet,
      layoutSnippetDecoration: ownProps.snippetDecoration,
      onHideConversation: dispatchProps.onHideConversation,
      onMuteConversation: () => dispatchProps.onMuteConversation(stateProps._meta.isMuted),
      // Don't allow you to select yourself
      onSelectConversation: isSelected ? () => {} : dispatchProps.onSelectConversation,
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
  },
  'SmallTeam'
)(SmallTeam)
