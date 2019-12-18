import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import {memoize} from '../../../util/memoize'

export type RemoteConvMeta = any

// A hack to store the username to avoid plumbing.
let _username: string

export const conversationsToSend = memoize(
  (
    inboxLayout: Types.State['inboxLayout'],
    metaMap: Types.State['metaMap'],
    badgeMap: Types.State['badgeMap'],
    unreadMap: Types.State['unreadMap'],
    username: string
  ) => {
    // a terrible hack to capture this since the serialize flow doesn't understand things outside of itself
    _username = username
    // and a terrible hack
    return inboxLayout?.widgetList?.map(v => ({
      conversation: metaMap.get(v.convID) || {
        ...Constants.makeConversationMeta(),
        conversationIDKey: v.convID,
      },
      hasBadge: !!badgeMap.get(v.convID),
      hasUnread: !!unreadMap.get(v.convID),
    }))
  }
)

export const changeAffectsWidget = (oldConv: Types.ConversationMeta, newConv: Types.ConversationMeta) =>
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

export const serialize = (s: {
  hasBadge: boolean
  hasUnread: boolean
  conversation: Types.ConversationMeta
}): RemoteConvMeta => {
  const {hasBadge, hasUnread, conversation} = s
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
