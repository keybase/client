import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as ChatTypes from '../../../constants/types/chat2'
import {TypedState} from '../../../constants/reducer'

export type RemoteConvMeta = any

// A hack to store the username to avoid plumbing.
let _username: string
let _lastSent:
  | Array<{
      hasBadge: boolean
      hasUnread: boolean
      conversation: ChatTypes.ConversationMeta
    }>
  | undefined
let _lastSentParams = {
  badgeCount: 0,
  inboxVers: '',
  unreadCount: 0,
}

const changed = (state: TypedState) => {
  const {metaMap, inboxLayout, badgeMap, unreadMap} = state.chat2

  const nextSentParams = {
    badgeCount: 0,
    inboxVers: '',
    unreadCount: 0,
  }

  const wl = inboxLayout?.widgetList
  wl?.forEach(w => {
    const {convID} = w
    nextSentParams.badgeCount += badgeMap.get(convID) ? 1 : 0
    nextSentParams.unreadCount += unreadMap.get(convID) ? 1 : 0
    nextSentParams.inboxVers += `:${metaMap.get(convID)?.inboxVersion ?? 'none'}`
  })

  const isChanged =
    !_lastSentParams ||
    !_lastSent ||
    nextSentParams.badgeCount !== _lastSentParams.badgeCount ||
    nextSentParams.unreadCount !== _lastSentParams.unreadCount ||
    nextSentParams.inboxVers !== _lastSentParams.inboxVers

  isChanged && console.log('aaa ischanged', isChanged, _lastSentParams, nextSentParams)
  if (isChanged) {
    _lastSentParams = nextSentParams
  }

  return isChanged
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
