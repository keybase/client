// Debug utilities for chat
import * as React from 'react'
import type * as T from '@/constants/types'
import logger from '@/logger'
import {debugWarning} from '@/util/debug-warning'
import {registerDebugClear} from '@/util/debug'
import {getConversationThreadCacheSnapshot} from '@/chat/conversation/thread-cache'

export const chatDebugEnabled = false as boolean

if (chatDebugEnabled) {
  debugWarning('Debug chat enabled!')
}

const dumpMap = new Map<string, () => string>()
registerDebugClear(() => {
  dumpMap.clear()
})

const chatDebugDump = chatDebugEnabled
  ? (conversationIDKey: T.Chat.ConversationIDKey) => {
      const snapshot = getConversationThreadCacheSnapshot(conversationIDKey)
      if (!snapshot) {
        logger.error('[CHATDEBUG] no cached snapshot for: ', conversationIDKey)
        return
      }
      logger.error('[CHATDEBUG] os: ', snapshot.messageOrdinals)
      // logger.error('[CHATDEBUG] orange: ', cs.orangeAboveOrdinal)
      const m = snapshot.meta
      logger.error('[CHATDEBUG] meta: ', {
        inboxLocalVersion: m.inboxLocalVersion,
        inboxVersion: m.inboxVersion,
        maxMsgID: m.maxMsgID,
        maxVisibleMsgID: m.maxVisibleMsgID,
        offline: m.offline,
        readMsgID: m.readMsgID,
        status: m.status,
        timestamp: m.timestamp,
      })
      logger.error('[CHATDEBUG] pen: ', [...snapshot.pendingOutboxToOrdinal.entries()])
      logger.error(
        '[CHATDEBUG] mm: ',
        [...snapshot.messageMap.entries()].map(([k, v]) => {
          const {id, ordinal, submitState, outboxID, type} = v
          return {
            key: k,
            length: type === 'text' ? v.text.stringValue().length : -1,
            mid: id,
            ordinal,
            outboxID,
            submitState,
            type,
          }
        })
      )
      const lines = [...dumpMap.values()]
        .reduce((strs, cb) => {
          strs.push(cb())
          return strs
        }, new Array<string>())
        .join('\n')
      logger.error('[CHATDEBUG]: ', lines)
    }
  : undefined

export const DebugChatDumpContext = React.createContext({chatDebugDump})

export const useChatDebugDump = chatDebugEnabled
  ? (key: string, dumpCB: () => string) => {
      React.useEffect(() => {
        dumpMap.set(key, dumpCB)
        return () => {
          dumpMap.delete(key)
        }
      }, [key, dumpCB])
    }
  : (_key: string, _dumpCB: () => string) => {}
