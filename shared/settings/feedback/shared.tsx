import * as ChatConstants from '../../constants/chat2'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/settings'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Z from '../../util/zustand'
import logger from '../../logger'
import {RPCError} from '../../util/errors'
import {androidIsTestDevice, version} from '../../constants/platform'
import {getMeta} from '../../constants/chat2/meta'

export const getExtraChatLogsForLogSend = () => {
  const state = Z.getReduxStore()()
  const chat = state.chat2
  const c = ChatConstants.getSelectedConversation()
  if (c) {
    const metaMap = getMeta(state, c)
    return {
      editingMap: chat.editingMap.get(c),
      messageMap: [...(chat.messageMap.get(c)?.values() ?? [])].map(m => ({
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
        rekeyers: metaMap.rekeyers?.size,
        resetParticipants: metaMap.resetParticipants?.size,
        retentionPolicy: metaMap.retentionPolicy,
        snippet: 'x',
        snippetDecoration: RPCChatTypes.SnippetDecoration.none,
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
    }
  }
  return {}
}

export const useSendFeedback = () => {
  const [error, setError] = React.useState('')
  const sendFeedback = React.useCallback((feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => {
    const f = async () => {
      // We don't want test devices (pre-launch reports) to send us log sends.
      if (androidIsTestDevice) {
        return
      }
      try {
        if (sendLogs) {
          await logger.dump()
        }
        const status = {version}
        logger.info(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
        const extra = sendLogs ? {...status, ...getExtraChatLogsForLogSend()} : status
        const logSendId = await RPCTypes.configLogSendRpcPromise(
          {
            feedback: feedback || '',
            sendLogs,
            sendMaxBytes,
            statusJSON: JSON.stringify(extra),
          },
          Constants.sendFeedbackWaitingKey
        )
        logger.info('logSendId is', logSendId)
      } catch (error) {
        if (!(error instanceof RPCError)) {
          return
        }
        logger.warn('err in sending logs', error)
        setError(error.desc)
      }
    }
    Z.ignorePromise(f())
  }, [])

  return {error, sendFeedback}
}
