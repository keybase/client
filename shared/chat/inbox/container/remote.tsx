import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as ChatTypes from '../../../constants/types/chat2'
import {TypedState} from '../../../constants/reducer'
import {memoize} from '../../../util/memoize'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

export type RemoteConvMeta = any
/* Exclude<
  {
    conversationIDKey: ChatTypes.ConversationIDKey
  } & SmallTeam.Props,
  {
    onSelectConversation: () => void
  }
> */

// To cache the list
const valuesCached = memoize(
  (
    inboxLayout: RPCChatTypes.UIInboxLayout | null,
    badgeMap,
    unreadMap,
    metaMap
  ): Array<{
    hasBadge: boolean
    hasUnread: boolean
    conversation: ChatTypes.ConversationMeta
  }> =>
    ((inboxLayout && inboxLayout.widgetList) || []).map(v => ({
      conversation: metaMap.get(v.convID) || {
        ...Constants.makeConversationMeta(),
        conversationIDKey: v.convID,
      },
      hasBadge: badgeMap.get(v.convID, 0) > 0,
      hasUnread: unreadMap.get(v.convID, 0) > 0,
    }))
)

// A hack to store the username to avoid plumbing.
let _username: string
export const conversationsToSend = (state: TypedState) => {
  _username = state.config.username
  return valuesCached(
    state.chat2.inboxLayout,
    state.chat2.badgeMap,
    state.chat2.unreadMap,
    state.chat2.metaMap
  )
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
