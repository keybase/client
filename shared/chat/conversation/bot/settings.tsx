import * as React from 'react'
import type * as T from '@/constants/types'
import logger from '@/logger'
import {getChatRpc} from '../chat-rpc'
import type {RPCError} from '@/util/errors'

export const useBotSettings = (
  conversationIDKey: T.Chat.ConversationIDKey | undefined,
  botUsername: string,
  enabled = true
) => {
  const [loaded, setLoaded] = React.useState<
    | {
        botUsername: string
        conversationIDKey: T.Chat.ConversationIDKey
        failed?: boolean
        settings?: T.RPCGen.TeamBotSettings
      }
    | undefined
  >()
  const requestIDRef = React.useRef(0)

  React.useEffect(() => {
    requestIDRef.current += 1
    if (!conversationIDKey || !enabled) {
      return undefined
    }
    const requestID = requestIDRef.current
    getChatRpc()
      .getBotSettings(conversationIDKey, botUsername)
      .then(settings => {
        if (requestIDRef.current !== requestID) {
          return
        }
        setLoaded({botUsername, conversationIDKey, settings})
      })
      .catch((error: RPCError) => {
        if (requestIDRef.current !== requestID) {
          return
        }
        logger.info(`useBotSettings: failed to refresh settings for ${botUsername}: ${error.message}`)
        setLoaded({botUsername, conversationIDKey, failed: true})
      })
    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [botUsername, conversationIDKey, enabled])

  const current =
    enabled &&
    loaded &&
    loaded.conversationIDKey === conversationIDKey &&
    loaded.botUsername === botUsername
      ? loaded
      : undefined
  const settings = current?.settings
  // nothing retries this load, so callers have to be able to tell a failure from a
  // load still in flight
  const failed = !!current?.failed
  const setSettings = React.useCallback(
    (settings: T.RPCGen.TeamBotSettings) => {
      if (conversationIDKey) {
        setLoaded({botUsername, conversationIDKey, settings})
      }
    },
    [botUsername, conversationIDKey]
  )
  return {failed, setSettings, settings}
}
