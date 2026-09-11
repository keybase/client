import * as React from 'react'
import * as T from '@/constants/types'
import {useEmojiState} from '@/teams/emojis/use-emoji'
import {createCachedResourceNamespace, useCachedResource} from '@/util/use-cached-resource'

const emptyEmojiGroups: ReadonlyArray<T.RPCChat.EmojiGroup> = []
const emptyEmojis: ReadonlyArray<T.RPCChat.Emoji> = []

type UserEmojiData = {
  emojiGroups: ReadonlyArray<T.RPCChat.EmojiGroup>
  emojis: ReadonlyArray<T.RPCChat.Emoji>
}

const emptyUserEmojiData: UserEmojiData = {emojiGroups: emptyEmojiGroups, emojis: emptyEmojis}

// One cache per request key, shared by every consumer. userEmojis is expensive on
// the service side - it resolves two attachment URLs per custom emoji - so the
// suggestor remounting on each ':' trigger used to refetch the entire set. The
// shared cache also collapses concurrent mounts onto a single in-flight request.
// an entry holds every custom emoji the conv can see, with two resolved
// attachment URLs each, and every channel of a team keeps its own copy, so this
// is capped by size rather than left to grow for the life of the session
const userEmoji = createCachedResourceNamespace<UserEmojiData, string>(
  'chat-user-emoji-caches',
  () => emptyUserEmojiData,
  {maxEntries: 32}
)
const userEmojiStaleMs = 60_000

// Adding, aliasing or removing an emoji has to drop the shared entries from the
// store, not from a mounted consumer: the edit happens on the team emoji page,
// where nothing is using useUserEmoji, so by the time the picker or the
// suggestor mounts there is no trigger change left for it to notice and the
// entry is still inside its stale window.
useEmojiState.subscribe((state, prev) => {
  if (state.emojiUpdatedTrigger === prev.emojiUpdatedTrigger) {
    return
  }
  userEmoji.invalidateAll()
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
  // the store subscription above already dropped the shared entries; this makes
  // the mounted consumers re-run their load and pick the new set up
  const emojiUpdatedTrigger = useEmojiState(s => s.emojiUpdatedTrigger)
  const load = React.useCallback(async () => {
    const results = await T.RPCChat.localUserEmojisRpcPromise({
      convID:
        conversationIDKey && conversationIDKey !== T.Chat.noConversationIDKey
          ? T.Chat.keyToConversationID(conversationIDKey)
          : null,
      opts: {
        getAliases: true,
        getCreationInfo: false,
        onlyInTeam: requestOnlyInTeam,
      },
    })
    const emojiGroups = results.emojis.emojis ?? emptyEmojiGroups
    return {emojiGroups, emojis: flattenUserEmojis(emojiGroups)}
  }, [conversationIDKey, requestOnlyInTeam])

  const {data, loading} = useCachedResource({
    cacheKey: requestKey,
    enabled: !disabled,
    initialData: emptyUserEmojiData,
    load,
    namespace: userEmoji,
    refreshKey: emojiUpdatedTrigger,
    staleMs: userEmojiStaleMs,
  })

  return {
    emojiGroups: disabled ? undefined : data.emojiGroups,
    emojis: data.emojis,
    loading,
  }
}
