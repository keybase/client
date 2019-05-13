// @flow
import {type PropsWithTimer} from '../../common-adapters'
import * as I from 'immutable'
import * as ChatConstants from '../../constants/chat2'

export type State = {
  sentFeedback: boolean,
  feedback: ?string,
  sending: boolean,
  sendLogs: boolean,
  sendError: ?Error,
}

export type Props = PropsWithTimer<{
  chat: Object,
  onBack: () => void,
  status: Object,
  title: string,
}>

export const extraChatLogs = (state: Object) => {
  const chat = state.chat2
  const c = state.chat2.selectedConversation
  if (c) {
    const metaMap: Object = ChatConstants.getMeta(state, c).toJS()
    return I.Map({
      badgeMap: chat.badgeMap.get(c),
      editingMap: chat.editingMap.get(c),
      messageMap: chat.messageMap.get(c, I.Map()).map(m => ({
        a: m.author,
        i: m.id,
        o: m.ordinal,
        out: (m.type === 'text' || m.type === 'attachment') && m.outboxID,
        s: (m.type === 'text' || m.type === 'attachment') && m.submitState,
        t: m.type,
      })),
      messageOrdinals: chat.messageOrdinals.get(c),
      metaMap: {
        channelname: 'x',
        conversationIDKey: metaMap.conversationIDKey,
        description: 'x',
        inboxVersion: metaMap.inboxVersion,
        isMuted: metaMap.isMuted,
        membershipType: metaMap.membershipType,
        notificationsDesktop: metaMap.notificationsDesktop,
        notificationsGlobalIgnoreMentions: metaMap.notificationsGlobalIgnoreMentions,
        notificationsMobile: metaMap.notificationsMobile,
        offline: metaMap.offline,
        participants: 'x',
        rekeyers: metaMap.rekeyers && metaMap.rekeyers.size,
        resetParticipants: metaMap.resetParticipants && metaMap.resetParticipants.size,
        retentionPolicy: metaMap.retentionPolicy,
        snippet: 'x',
        snippetDecoration: 'x',
        supersededBy: metaMap.supersededBy,
        supersedes: metaMap.supersedes,
        teamRetentionPolicy: metaMap.teamRetentionPolicy,
        teamType: metaMap.teamType,
        teamname: metaMap.teamname,
        timestamp: metaMap.timestamp,
        tlfname: metaMap.tlfname,
        trustedState: metaMap.trustedState,
        wasFinalizedBy: metaMap.wasFinalizedBy,
      },
      pendingOutboxToOrdinal: chat.pendingOutboxToOrdinal.get(c),
      quote: chat.quote,
      unreadMap: chat.unreadMap.get(c),
    }).toJS()
  }
  return {}
}
