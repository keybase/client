import * as T from '@/constants/types'
import * as Meta from '@/constants/chat/meta'
import {metasReceived} from '@/chat/inbox/metadata'
import {createCachedResourceNamespace, useCachedResource} from '@/util/use-cached-resource'

type GeneralConvData = T.Chat.ConversationIDKey | undefined

const noGeneralConv: GeneralConvData = undefined

// A team's #general conversation does not move, but two screens ask for it - the
// team rows and the bot install modal - and each used to hold the answer in its
// own state, so every mount was another findGeneralConvFromTeamID. Share one
// cache per team, and let it live a while since the answer is effectively static.
const generalConvs = createCachedResourceNamespace<GeneralConvData, T.Teams.TeamID>(
  'teams-general-conv-caches',
  () => noGeneralConv
)
const generalConvStaleMs = 5 * 60_000

export const useGeneralConvIDKey = (teamID?: T.Teams.TeamID, enabled = true) => {
  const validTeamID = teamID && teamID !== T.Teams.noTeamID ? teamID : undefined
  const {data} = useCachedResource({
    cacheKey: validTeamID,
    enabled,
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
    namespace: generalConvs,
    staleMs: generalConvStaleMs,
  })
  return data
}
