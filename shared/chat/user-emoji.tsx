import * as T from '@/constants/types'
import {useRPCLoad} from '@/util/use-rpc-load'

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
  const requestOnlyInTeam = onlyInTeam ?? false
  const requestKey = `${conversationIDKey ?? T.Chat.noConversationIDKey}:${
    requestOnlyInTeam ? 'team' : 'all'
  }`
  const {data, loading} = useRPCLoad(
    T.RPCChat.localUserEmojisRpcPromise,
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
    {
      enabled: !disabled,
      key: requestKey,
      map: results => {
        const nextGroups = results.emojis.emojis ?? emptyEmojiGroups
        return {emojiGroups: nextGroups, emojis: flattenUserEmojis(nextGroups)}
      },
    }
  )
  return {
    emojiGroups: disabled ? undefined : (data?.emojiGroups ?? emptyEmojiGroups),
    emojis: data?.emojis ?? emptyEmojis,
    loading,
  }
}
