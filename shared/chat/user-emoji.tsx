import * as React from 'react'
import * as T from '@/constants/types'
import {useEmojiState} from '@/teams/emojis/use-emoji'
import {
  type CachedResourceCache,
  createCachedResourceCache,
  getCachedResourceCache,
  useCachedResource,
} from '@/teams/use-cached-resource'
import {registerExternalResetter} from '@/util/zustand'

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
const userEmojiCaches = new Map<string, CachedResourceCache<UserEmojiData, string>>()
const userEmojiStaleMs = 60_000

// module scope outlives sign-out, so the next user would be served the previous
// user's custom emoji until the entries went stale
registerExternalResetter('chat-user-emoji-caches', () => {
  userEmojiCaches.clear()
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
  // adding, aliasing or removing an emoji bumps this; it busts the cache so the
  // picker and the suggestor pick the change up instead of serving a stale set
  const emojiUpdatedTrigger = useEmojiState(s => s.emojiUpdatedTrigger)
  // a disabled instance resets the cache it holds, so keep those off the shared one
  const [localCache] = React.useState<CachedResourceCache<UserEmojiData, string>>(() =>
    createCachedResourceCache(emptyUserEmojiData, requestKey)
  )
  const sharedCache = React.useMemo(
    () => getCachedResourceCache(userEmojiCaches, emptyUserEmojiData, requestKey),
    [requestKey]
  )
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

  const {data, loading, reload} = useCachedResource({
    cache: disabled ? localCache : sharedCache,
    cacheKey: requestKey,
    enabled: !disabled,
    initialData: emptyUserEmojiData,
    load,
    refreshKey: emojiUpdatedTrigger,
    staleMs: userEmojiStaleMs,
  })

  // refreshKey alone only re-checks staleness, and an edit we just made is never
  // stale — force past the cache when the emoji set actually changed
  const lastEmojiUpdatedTriggerRef = React.useRef(emojiUpdatedTrigger)
  React.useEffect(() => {
    if (lastEmojiUpdatedTriggerRef.current === emojiUpdatedTrigger) {
      return
    }
    lastEmojiUpdatedTriggerRef.current = emojiUpdatedTrigger
    if (!disabled) {
      void reload()
    }
  }, [disabled, emojiUpdatedTrigger, reload])

  return {
    emojiGroups: disabled ? undefined : data.emojiGroups,
    emojis: data.emojis,
    loading,
  }
}
