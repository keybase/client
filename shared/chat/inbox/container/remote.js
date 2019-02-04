// @flow
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as SmallTeam from '../row/small-team'
import * as ChatTypes from '../../../constants/types/chat2'
import type {TypedState} from '../../../constants/reducer'
import {memoize} from '../../../util/memoize'

export const maxShownConversations = 3

export type RemoteConvMeta = $Diff<
  {|
    ...$Exact<SmallTeam.Props>,
    conversationIDKey: ChatTypes.ConversationIDKey,
  |},
  {onSelectConversation: () => void}
>

// To cache the list
const valuesCached = memoize(
  (
    badgeMap,
    unreadMap,
    metaMap
  ): Array<{
    hasBadge: boolean,
    hasUnread: boolean,
    conversation: ChatTypes.ConversationMeta,
  }> =>
    metaMap
      .filter((_, id) => Constants.isValidConversationIDKey(id))
      .map(v => ({
        conversation: v,
        hasBadge: badgeMap.get(v.conversationIDKey, 0) > 0,
        hasUnread: unreadMap.get(v.conversationIDKey, 0) > 0,
      }))
      .sort((a, b) =>
        a.hasBadge
          ? b.hasBadge
            ? b.conversation.timestamp - a.conversation.timestamp
            : -1
          : b.hasBadge
          ? 1
          : b.conversation.timestamp - a.conversation.timestamp
      )
      .take(maxShownConversations)
      .valueSeq()
      .toArray()
)

// A hack to store the username to avoid plumbing.
let _username: string
export const conversationsToSend = (state: TypedState) => {
  _username = state.config.username
  return valuesCached(state.chat2.badgeMap, state.chat2.unreadMap, state.chat2.metaMap)
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
  hasBadge: boolean,
  hasUnread: boolean,
  conversation: ChatTypes.ConversationMeta,
}): RemoteConvMeta => {
  const styles = Constants.getRowStyles(conversation, false, hasUnread)
  const participantNeedToRekey = conversation.rekeyers.size > 0
  const youNeedToRekey = !!participantNeedToRekey && conversation.rekeyers.has(_username)
  return {
    backgroundColor: Styles.globalColors.white,
    channelname: conversation.channelname,
    conversationIDKey: conversation.conversationIDKey,
    hasBadge,
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
    participants: conversation.teamname
      ? []
      : Constants.getRowParticipants(conversation, _username).toArray(),
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
