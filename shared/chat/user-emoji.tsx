import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'

const emptyEmojiGroups: ReadonlyArray<T.RPCChat.EmojiGroup> = []
const emptyEmojis: ReadonlyArray<T.RPCChat.Emoji> = []

const flattenUserEmojis = (groups: ReadonlyArray<T.RPCChat.EmojiGroup>) => {
  const emojis = new Array<T.RPCChat.Emoji>()
  groups.forEach(group => {
    group.emojis?.forEach(emoji => emojis.push(emoji))
  })
  return emojis
}

export const useUserEmoji = ({
  conversationIDKey,
  disabled,
  onlyInTeam,
}: {
  conversationIDKey?: T.Chat.ConversationIDKey
  disabled?: boolean
  onlyInTeam?: boolean
}) => {
  const loadUserEmoji = C.useRPC(T.RPCChat.localUserEmojisRpcPromise)
  const [emojiGroups, setEmojiGroups] = React.useState<ReadonlyArray<T.RPCChat.EmojiGroup>>(emptyEmojiGroups)
  const [emojis, setEmojis] = React.useState<ReadonlyArray<T.RPCChat.Emoji>>(emptyEmojis)
  const [loading, setLoading] = React.useState(false)
  const requestIDRef = React.useRef(0)

  React.useEffect(() => {
    if (disabled) {
      requestIDRef.current += 1
      setLoading(false)
      return
    }

    const requestID = requestIDRef.current + 1
    requestIDRef.current = requestID
    setLoading(true)

    loadUserEmoji(
      [
        {
          convID:
            conversationIDKey && conversationIDKey !== T.Chat.noConversationIDKey
              ? T.Chat.keyToConversationID(conversationIDKey)
              : null,
          opts: {
            getAliases: true,
            getCreationInfo: false,
            onlyInTeam: onlyInTeam ?? false,
          },
        },
      ],
      results => {
        if (requestIDRef.current !== requestID) {
          return
        }
        const nextGroups = results.emojis.emojis ?? emptyEmojiGroups
        setEmojiGroups(nextGroups)
        setEmojis(flattenUserEmojis(nextGroups))
        setLoading(false)
      },
      () => {
        if (requestIDRef.current !== requestID) {
          return
        }
        setLoading(false)
      }
    )

    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [conversationIDKey, disabled, loadUserEmoji, onlyInTeam])

  return {
    emojiGroups: disabled ? undefined : emojiGroups,
    emojis,
    loading: disabled ? false : loading,
  }
}
