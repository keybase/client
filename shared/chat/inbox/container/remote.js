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
const valuesCached = memoize((...vals) => vals.map(v => v))

const metaMapToFirstValues = memoize((metaMap, _lastState) =>
  metaMap
    .filter((meta, id) => {
      if (Constants.isValidConversationIDKey(id)) {
        if (meta.teamType === 'adhoc') {
          // DM's
          return !meta.isMuted
        } else if (meta.teamType === 'big') {
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
          return false
        }
        return false
      }
      return false
    })
    .partialSort(maxShownConversations, (a, b) => b.timestamp - a.timestamp)
    .valueSeq()
    .toArray()
)

// A hack to store the state so we can convert at the last possible minute. This is a lot simpler than plumbing this all the way through
let _lastState: TypedState
export const conversationsToSend = (state: TypedState) => {
  _lastState = state
  return valuesCached(...metaMapToFirstValues(state.chat2.metaMap, _lastState))
}

export const serialize = (m: ChatTypes.ConversationMeta): RemoteConvMeta => {
  const hasUnread = Constants.getHasUnread(_lastState, m.conversationIDKey)
  const styles = Constants.getRowStyles(m, false, hasUnread)
  const participantNeedToRekey = m.rekeyers.size > 0
  const _username = _lastState.config.username || ''
  const youNeedToRekey = !!participantNeedToRekey && m.rekeyers.has(_username)
  return {
    backgroundColor: Styles.globalColors.white,
    channelname: m.channelname,
    conversationIDKey: m.conversationIDKey,
    hasBadge: Constants.getHasBadge(_lastState, m.conversationIDKey),
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
