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

type UserEmojiLoadState = {
  completedKey: string
  emojiGroups: ReadonlyArray<T.RPCChat.EmojiGroup>
  emojis: ReadonlyArray<T.RPCChat.Emoji>
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
  const requestOnlyInTeam = onlyInTeam ?? false
  const requestKey = `${conversationIDKey ?? T.Chat.noConversationIDKey}:${
    requestOnlyInTeam ? 'team' : 'all'
  }`
  const [loadState, setLoadState] = React.useState<UserEmojiLoadState>(() => ({
    completedKey: '',
    emojiGroups: emptyEmojiGroups,
    emojis: emptyEmojis,
  }))
  const requestIDRef = React.useRef(0)

  React.useEffect(() => {
    if (disabled) {
      requestIDRef.current += 1
      return
    }

    const requestID = requestIDRef.current + 1
    requestIDRef.current = requestID

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
            onlyInTeam: requestOnlyInTeam,
          },
        },
      ],
      results => {
        if (requestIDRef.current !== requestID) {
          return
        }
        const nextGroups = results.emojis.emojis ?? emptyEmojiGroups
        setLoadState({
          completedKey: requestKey,
          emojiGroups: nextGroups,
          emojis: flattenUserEmojis(nextGroups),
        })
      },
      () => {
        if (requestIDRef.current !== requestID) {
          return
        }
        setLoadState(state => ({
          ...state,
          completedKey: requestKey,
        }))
      }
    )

    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [conversationIDKey, disabled, loadUserEmoji, requestKey, requestOnlyInTeam])

  return {
    emojiGroups: disabled ? undefined : loadState.emojiGroups,
    emojis: loadState.emojis,
    loading: !disabled && loadState.completedKey !== requestKey,
  }
}
