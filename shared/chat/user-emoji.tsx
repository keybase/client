import * as T from '@/constants/types'
import {useEmojiState} from '@/teams/emojis/use-emoji'
import {refreshLoad, useLoadData} from '@/query'

const emptyEmojiGroups: ReadonlyArray<T.RPCChat.EmojiGroup> = []
const emptyEmojis: ReadonlyArray<T.RPCChat.Emoji> = []

type UserEmojiData = {
  emojiGroups: ReadonlyArray<T.RPCChat.EmojiGroup>
  emojis: ReadonlyArray<T.RPCChat.Emoji>
}

const emptyUserEmojiData: UserEmojiData = {emojiGroups: emptyEmojiGroups, emojis: emptyEmojis}

// One cache entry per request key, shared by every consumer: userEmojis is expensive on
// the service side (it resolves two attachment URLs per custom emoji), and the suggestor
// remounts on each ':' trigger.
const userEmojiStaleMs = 60_000
const userEmojisLoad = 'chat.userEmojis'

// Adding, aliasing or removing an emoji happens on the team emoji page, where
// nothing is using useUserEmoji: every entry goes stale, the mounted consumers
// reload, and the picker or the suggestor reloads when it next mounts.
useEmojiState.subscribe((state, prev) => {
  if (state.emojiUpdatedTrigger !== prev.emojiUpdatedTrigger) {
    refreshLoad(userEmojisLoad)
  }
})

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
  const {data = emptyUserEmojiData, loading} = useLoadData(
    userEmojisLoad,
    requestKey,
    async (signal): Promise<UserEmojiData> => {
      const results = await T.RPCChat.localUserEmojisRpcPromise(
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
        undefined,
        signal
      )
      const emojiGroups = results.emojis.emojis ?? emptyEmojiGroups
      return {emojiGroups, emojis: flattenUserEmojis(emojiGroups)}
    },
    {enabled: !disabled, staleMs: userEmojiStaleMs}
  )

  return {
    emojiGroups: disabled ? undefined : data.emojiGroups,
    emojis: data.emojis,
    loading,
  }
}
