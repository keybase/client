// @flow
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as SmallTeam from '../row/small-team'
import * as ChatTypes from '../../../constants/types/chat2'
import type {TypedState} from '../../../constants/reducer'
import memoize from 'memoize-one'

export const maxShownConversations = 3

export type RemoteConvMeta = $Diff<
  {|
    ...$Exact<SmallTeam.Props>,
    conversationIDKey: ChatTypes.ConversationIDKey,
  |},
  {onSelectConversation: () => void}
>

// To cache the list
const valuesCached = memoize((badgeMap, unreadMap, ...vals) =>
  vals.map(v => ({
    hasBadge: badgeMap.get(v.conversationIDKey, 0) > 0,
    hasUnread: unreadMap.get(v.conversationIDKey, 0) > 0,
    conversation: v,
  }))
)

const metaMapToFirstValues = memoize((metaMap, _lastState) =>
  metaMap
    .partialSort(maxShownConversations * 10, (a, b) => b.timestamp - a.timestamp)
    .partialSort(maxShownConversations, (a, b) => b.timestamp - a.timestamp)
    .filter((meta, id) => {
      if (!Constants.isValidConversationIDKey(id)) {
        return false
      }
      if (meta.teamType === 'adhoc') {
        // DM's
        return !meta.isMuted
      }
      if (!meta.teamType === 'big') {
        return false
      }
      // channels
      if (!meta.notificationsGlobalIgnoreMentions) {
        // @here and @mention not ignored
        if (meta.notificationsDesktop === 'onAnyActivity') {
          return true
        } else if (meta.notificationsDesktop === 'onWhenAtMentioned') {
          // check if user has been mentioned in the message
          let snippet = meta.snippet.toLowerCase()
          return (
            (!!_lastState.config.username && snippet.indexOf(`@${_lastState.config.username}`) === 0) ||
            snippet.indexOf('you') === 0
          )
        }
        return false
      }
    })
    .slice(0, maxShownConversations)
    .valueSeq()
    .toArray()
)

// A hack to store the username to avoid plumbing.
let _username: string
export const conversationsToSend = (state: TypedState) => {
  _username = state.config.username
  return valuesCached(
    state.chat2.badgeMap,
    state.chat2.unreadMap,
    ...metaMapToFirstValues(state.chat2.metaMap, _lastState)
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
    isFinalized: !!conversation.wasFinalizedBy,
    isInWidget: true,
    isMuted: conversation.isMuted,
    isSelected: false,
    // excluding onSelectConversation
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
