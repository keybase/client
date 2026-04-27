import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'

export const useBotSettings = (
  conversationIDKey: T.Chat.ConversationIDKey | undefined,
  botUsername: string,
  enabled = true
) => {
  const [loaded, setLoaded] = React.useState<
    | {
        botUsername: string
        conversationIDKey: T.Chat.ConversationIDKey
        settings?: T.RPCGen.TeamBotSettings
      }
    | undefined
  >()
  const loadBotSettings = C.useRPC(T.RPCChat.localGetBotMemberSettingsRpcPromise)
  const requestIDRef = React.useRef(0)

  React.useEffect(() => {
    requestIDRef.current += 1
    if (!conversationIDKey || !enabled) {
      return undefined
    }
    const requestID = requestIDRef.current
    loadBotSettings(
      [{convID: T.Chat.keyToConversationID(conversationIDKey), username: botUsername}],
      settings => {
        if (requestIDRef.current !== requestID) {
          return
        }
        setLoaded({botUsername, conversationIDKey, settings})
      },
      error => {
        if (requestIDRef.current !== requestID) {
          return
        }
        logger.info(`useBotSettings: failed to refresh settings for ${botUsername}: ${error.message}`)
        setLoaded({botUsername, conversationIDKey})
      }
    )
    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [botUsername, conversationIDKey, enabled, loadBotSettings])

  const settings =
    enabled && loaded?.conversationIDKey === conversationIDKey && loaded.botUsername === botUsername
      ? loaded.settings
      : undefined
  const setSettings = React.useCallback(
    (settings: T.RPCGen.TeamBotSettings) => {
      if (conversationIDKey) {
        setLoaded({botUsername, conversationIDKey, settings})
      }
    },
    [botUsername, conversationIDKey]
  )
  return {setSettings, settings}
}
