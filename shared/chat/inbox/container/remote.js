// @flow
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as SmallTeam from '../row/small-team'
import * as ChatTypes from '../../../constants/types/chat2'
import type {TypedState} from '../../../constants/reducer'
import Flags from '../../../util/feature-flags'
import memoize from 'memoize-one'

export const maxShownConversations = Flags.fileWidgetEnabled ? 3 : 7

export type RemoteConvMeta = $Diff<
  {|
    ...$Exact<SmallTeam.Props>,
    conversationIDKey: ChatTypes.ConversationIDKey,
  |},
  {onSelectConversation: () => void}
>

// To cache the list
const valuesCached = memoize((state, ...vals) =>
  vals.map(v => ({
    hasBadge: Constants.getHasBadge(state, v.conversationIDKey),
    hasUnread: Constants.getHasUnread(state, v.conversationIDKey),
    conversation: v,
  }))
)

const metaMapToFirstValues = memoize(metaMap =>
  metaMap
    .partialSort(maxShownConversations, (a, b) => b.timestamp - a.timestamp)
    .filter((_, id) => Constants.isValidConversationIDKey(id))
    .valueSeq()
    .toArray()
)

// A hack to store the username to avoid plumbing.
let _username: string
export const conversationsToSend = (state: TypedState) => {
  _username = state.config.username
  return valuesCached(state, ...metaMapToFirstValues(state.chat2.metaMap))
}

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
