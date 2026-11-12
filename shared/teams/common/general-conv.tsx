import * as T from '@/constants/types'
import * as Meta from '@/constants/chat/meta'
import {metasReceived} from '@/chat/inbox/metadata'
import {useLoadData} from '@/query'

type GeneralConvData = T.Chat.ConversationIDKey | undefined

const noGeneralConv: GeneralConvData = undefined

// A team's #general conversation does not move, but two screens ask for it - the
// team rows and the bot install modal - and each used to hold the answer in its
// own state, so every mount was another findGeneralConvFromTeamID. Share one
// cache per team, and let it live a while since the answer is effectively static.
const generalConvStaleMs = 5 * 60_000

export const useGeneralConvIDKey = (teamID?: T.Teams.TeamID, enabled = true) => {
  const validTeamID = teamID && teamID !== T.Teams.noTeamID ? teamID : undefined
  const on = enabled && !!validTeamID
  const teamIDToLoad = validTeamID ?? T.Teams.noTeamID
  const {data} = useLoadData(
    'chat.generalConv',
    teamIDToLoad,
    async (signal): Promise<GeneralConvData | null> => {
      const conv = await T.RPCChat.localFindGeneralConvFromTeamIDRpcPromise({teamID: teamIDToLoad}, undefined, signal)
      const meta = Meta.inboxUIItemToConversationMeta(conv)
      if (!meta) {
        return null
      }
      metasReceived([meta])
      return meta.conversationIDKey
    },
    {enabled: on, staleMs: generalConvStaleMs}
  )
  return data ?? noGeneralConv
}
