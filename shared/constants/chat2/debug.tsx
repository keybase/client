// Debug utilities for chat
import * as React from 'react'
import logger from '../../logger'

export const chatDebugEnabled = false

if (chatDebugEnabled) {
  for (let i = 0; i < 10; ++i) {
    console.log('Debug chat enabled!')
  }
}

const dumpMap = new Map<string, () => string>()

const chatDebugDump = chatDebugEnabled
  ? () => {
      const lines = [...dumpMap.values()]
        .reduce((strs, cb) => {
          strs.push(cb())
          return strs
        }, new Array<string>())
        .join('\n')
      logger.error('Debug chat dump', lines)
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
