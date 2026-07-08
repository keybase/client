// Debug utilities for chat
import * as React from 'react'
import type * as T from '@/constants/types'
import logger from '@/logger'
import {debugWarning} from '@/util/debug-warning'
import {registerDebugClear} from '@/util/debug-registry'

export const chatDebugEnabled = false as boolean

if (chatDebugEnabled) {
  debugWarning('Debug chat enabled!')
}

const dumpMap = new Map<string, () => string>()
registerDebugClear(() => {
  dumpMap.clear()
})

const chatDebugDump = chatDebugEnabled
  ? (_conversationIDKey: T.Chat.ConversationIDKey) => {
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
DebugChatDumpContext.displayName = 'DebugChatDumpContext'

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
