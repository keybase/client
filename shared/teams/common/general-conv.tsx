import * as React from 'react'
import * as T from '@/constants/types'
import * as Meta from '@/constants/chat/meta'
import {metasReceived} from '@/chat/inbox/metadata'
import {registerExternalResetter} from '@/util/zustand'
import {
  type CachedResourceCache,
  createCachedResourceCache,
  getCachedResourceCache,
  useCachedResource,
} from '../use-cached-resource'

type GeneralConvData = T.Chat.ConversationIDKey | undefined

const noGeneralConv: GeneralConvData = undefined

// A team's #general conversation does not move, but two screens ask for it - the
// team rows and the bot install modal - and each used to hold the answer in its
// own state, so every mount was another findGeneralConvFromTeamID. Share one
// cache per team, and let it live a while since the answer is effectively static.
const generalConvCaches = new Map<T.Teams.TeamID, CachedResourceCache<GeneralConvData, T.Teams.TeamID>>()
const generalConvStaleMs = 5 * 60_000

registerExternalResetter('teams-general-conv-caches', () => {
  generalConvCaches.clear()
})

export const useGeneralConvIDKey = (teamID?: T.Teams.TeamID, enabled = true) => {
  const validTeamID = teamID && teamID !== T.Teams.noTeamID ? teamID : undefined
  const on = enabled && !!validTeamID
  const cacheKey = validTeamID ?? T.Teams.noTeamID
  // a disabled instance resets whatever cache it holds, so keep it off the shared one
  const [localCache] = React.useState<CachedResourceCache<GeneralConvData, T.Teams.TeamID>>(() =>
    createCachedResourceCache<GeneralConvData, T.Teams.TeamID>(noGeneralConv, cacheKey)
  )
  const sharedCache = React.useMemo(
    () => getCachedResourceCache(generalConvCaches, noGeneralConv, cacheKey),
    [cacheKey]
  )
  const {data} = useCachedResource({
    cache: on ? sharedCache : localCache,
    cacheKey,
    enabled: on,
    initialData: noGeneralConv,
    load: async () => {
      const conv = await T.RPCChat.localFindGeneralConvFromTeamIDRpcPromise({
        teamID: validTeamID ?? T.Teams.noTeamID,
      })
      const meta = Meta.inboxUIItemToConversationMeta(conv)
      if (!meta) {
        return noGeneralConv
      }
      metasReceived([meta])
      return meta.conversationIDKey
    },
    staleMs: generalConvStaleMs,
  })
  return data
}
