// @flow
// import shallowEqual from 'shallowequal'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as SmallTeam from '../row/small-team'
import * as ChatTypes from '../../../constants/types/chat2'
import type {TypedState} from '../../../constants/reducers'
import memoize from 'memoize-one'

export const maxShownConversations = 7

export type RemoteConvMeta = $Diff<
  {|
    ...$Exact<SmallTeam.Props>,
    conversationIDKey: ChatTypes.ConversationIDKey,
  |},
  {onSelectConversation: () => void}
>

// Just to cache the sorted values
// const GetNewestConvMetas = createShallowEqualSelector([getSortedConvMetas], map => map)

// To cache the list
const valuesCached = memoize((...vals) => vals.map(v => v))

const metaMapToFirstValues = memoize(metaMap =>
  metaMap
    .partialSort(maxShownConversations, (a, b) => b.timestamp - a.timestamp)
    .valueSeq()
    .toArray()
)
export const conversationsToSend = (state: TypedState) =>
  valuesCached(...metaMapToFirstValues(state.chat2.metaMap))
export const serialize = (m: ChatTypes.Meta): RemoteConvMeta => {
  const hasUnread = Constants.getHasUnread(state, m.conversationIDKey)
  const styles = Constants.getRowStyles(m, false, hasUnread)
  const participantNeedToRekey = m.rekeyers.size > 0
  const _username = state.config.username || ''
  const youNeedToRekey = !!participantNeedToRekey && m.rekeyers.has(_username)
  return {
    backgroundColor: Styles.globalColors.white,
    channelname: m.channelname,
    conversationIDKey: m.conversationIDKey,
    hasBadge: Constants.getHasBadge(state, m.conversationIDKey),
    hasResetUsers: !!m.resetParticipants && m.resetParticipants.size > 0,
    hasUnread,
    iconHoverColor: styles.iconHoverColor,
    isFinalized: !!m.wasFinalizedBy,
    isInWidget: true,
    isMuted: m.isMuted,
    isSelected: false,
    // excluding onSelectConversation
    participantNeedToRekey,
    participants: m.teamname ? [] : Constants.getRowParticipants(m, _username).toArray(),
    showBold: styles.showBold,
    snippet: m.snippet,
    snippetDecoration: m.snippetDecoration,
    subColor: styles.subColor,
    teamname: m.teamname,
    timestamp: Constants.timestampToString(m),
    usernameColor: styles.usernameColor,
    youAreReset: m.membershipType === 'youAreReset',
    youNeedToRekey,
  }
}
