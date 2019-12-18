import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as ChatTypes from '../../../constants/types/chat2'
import {TypedState} from '../../../constants/reducer'

export type RemoteConvMeta = any
/* Exclude<
  {
    conversationIDKey: ChatTypes.ConversationIDKey
  } & SmallTeam.Props,
  {
    onSelectConversation: () => void
  }
> */

// A hack to store the username to avoid plumbing.
let _username: string
let _lastSent:
  | Array<{
      hasBadge: boolean
      hasUnread: boolean
      conversation: ChatTypes.ConversationMeta
    }>
  | undefined

const changed = (state: TypedState) => {
  if (!_lastSent) {
    return true
  }

  const {metaMap, inboxLayout} = state.chat2

  const wl = inboxLayout?.widgetList
  if (wl?.length !== _lastSent.length) {
    return true
  }

  if (
    wl?.some(
      (w, idx) => (metaMap.get(w.convID)?.snippet ?? w.snippet) !== _lastSent?.[idx]?.conversation?.snippet
    )
  ) {
    console.log('aaaa inside changed')
    return true
  }

  console.log('aaaa same')
  return false
}

export const conversationsToSend = (state: TypedState) => {
  _username = state.config.username
  if (changed(state)) {
    const TEMP = _lastSent
    _lastSent = state.chat2.inboxLayout?.widgetList?.map(v => ({
      conversation: state.chat2.metaMap.get(v.convID) || {
        ...Constants.makeConversationMeta(),
        conversationIDKey: v.convID,
      },
      hasBadge: (state.chat2.badgeMap.get(v.convID) || 0) > 0,
      hasUnread: (state.chat2.unreadMap.get(v.convID) || 0) > 0,
    }))

    console.log('aaa diff', TEMP, _lastSent)
  }
  return _lastSent
}

export const changeAffectsWidget = (
  oldConv: ChatTypes.ConversationMeta,
  newConv: ChatTypes.ConversationMeta
) =>
  oldConv !== newConv &&
  !(
    oldConv.rekeyers === newConv.rekeyers &&
    oldConv.channelname === newConv.channelname &&
    oldConv.conversationIDKey === newConv.conversationIDKey &&
    oldConv.resetParticipants === newConv.resetParticipants &&
    oldConv.wasFinalizedBy === newConv.wasFinalizedBy &&
    oldConv.isMuted === newConv.isMuted &&
    oldConv.teamname === newConv.teamname &&
    oldConv.snippet === newConv.snippet &&
    oldConv.snippetDecoration === newConv.snippetDecoration &&
    oldConv.membershipType === newConv.membershipType
  )

export const serialize = ({
  hasBadge,
  hasUnread,
  conversation,
}: {
  hasBadge: boolean
  hasUnread: boolean
  conversation: ChatTypes.ConversationMeta
}): RemoteConvMeta => {
  const styles = Constants.getRowStyles(false, hasUnread)
  const participantNeedToRekey = conversation.rekeyers.size > 0
  const youNeedToRekey = !!participantNeedToRekey && conversation.rekeyers.has(_username)
  return {
    backgroundColor: Styles.globalColors.white,
    channelname: conversation.channelname,
    conversationIDKey: conversation.conversationIDKey,
    hasBadge,
    hasBottomLine: true,
    hasResetUsers: !!conversation.resetParticipants && conversation.resetParticipants.size > 0,
    hasUnread,
    iconHoverColor: styles.iconHoverColor,
    isDecryptingSnippet: false,
    isFinalized: !!conversation.wasFinalizedBy,
    isInWidget: true,
    isMuted: conversation.isMuted,
    // excluding onSelectConversation
    isSelected: false,
    isTypingSnippet: false,
    participantNeedToRekey,
    participants: conversation.teamname ? [] : Constants.getRowParticipants(conversation, _username),
    showBold: styles.showBold,
    snippet: conversation.snippet,
    snippetDecoration: conversation.snippetDecoration,
    subColor: styles.subColor,
    teamname: conversation.teamname,
    timestamp: Constants.timestampToString(conversation),
    usernameColor: styles.usernameColor,
    youAreReset: conversation.membershipType === 'youAreReset',
    youNeedToRekey,
  }
}
