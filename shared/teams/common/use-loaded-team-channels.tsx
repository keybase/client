import * as C from '@/constants'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as React from 'react'
import {useLoadedTeam} from '../team/use-loaded-team'
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '../use-cached-resource'

type LoadedTeamChannels = {
  channels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>
  loading: boolean
  reload: () => Promise<void>
}

type LoadedTeamChannelsContextValue = LoadedTeamChannels & {
  teamID: T.Teams.TeamID
}

type LoadedTeamChannelsData = Pick<LoadedTeamChannels, 'channels'>
type LoadedTeamChannelsCacheMap = Map<
  T.Teams.TeamID | undefined,
  CachedResourceCache<LoadedTeamChannelsData, T.Teams.TeamID | undefined>
>

const LoadedTeamChannelsContext = React.createContext<LoadedTeamChannelsContextValue | null>(null)
const LoadedTeamChannelsCacheContext = React.createContext<LoadedTeamChannelsCacheMap | null>(null)
const loadedTeamChannelsReloadStaleMs = 5_000

const emptyChannels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo> = new Map()

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamChannelsData: LoadedTeamChannelsData = {channels: emptyChannels}

const useLoadedTeamChannelsCacheMap = (providedCacheMap?: LoadedTeamChannelsCacheMap) => {
  const contextCacheMap = React.useContext(LoadedTeamChannelsCacheContext)
  const [localCacheMap] = React.useState<LoadedTeamChannelsCacheMap>(() => new Map())
  return providedCacheMap ?? contextCacheMap ?? localCacheMap
}

const useLoadedTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  providedTeamname?: string,
  enabled = true,
  providedCacheMap?: LoadedTeamChannelsCacheMap
): LoadedTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const {
    teamMeta: {teamname: loadedTeamname},
  } = useLoadedTeam(teamID, enabled)
  const teamnameToLoad = providedTeamname || loadedTeamname
  const cacheMap = useLoadedTeamChannelsCacheMap(providedCacheMap)
  const cache = React.useMemo(
    () => getCachedResourceCache(cacheMap, emptyLoadedTeamChannelsData, validTeamID),
    [cacheMap, validTeamID]
  )
  const {data, loading, reload, clear} = useCachedResource({
    cache,
    cacheKey: validTeamID,
    enabled: enabled && !!validTeamID && !!teamnameToLoad,
    initialData: emptyLoadedTeamChannelsData,
    load: async () => {
      if (!teamnameToLoad) {
        return emptyLoadedTeamChannelsData
      }
      const teamIDToLoad = validTeamID ?? T.Teams.noTeamID
      const teamname = teamnameToLoad
      const {convs} = await T.RPCChat.localGetTLFConversationsLocalRpcPromise(
        {
          membersType: T.RPCChat.ConversationMembersType.team,
          tlfName: teamname,
          topicType: T.RPCChat.TopicType.chat,
        },
        C.waitingKeyTeamsGetChannels(teamIDToLoad)
      )
      const channels =
        convs?.reduce((res, inboxUIItem) => {
          const conversationIDKey = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
          res.set(conversationIDKey, {
            channelname: inboxUIItem.channel,
            conversationIDKey,
            description: inboxUIItem.headline,
          })
          return res
        }, new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()) ??
        new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()

      return {
        channels,
      }
    },
    onError: error => {
      logger.warn(`Failed to load team channels for ${validTeamID}`, error)
    },
    refreshKey: teamnameToLoad,
    staleMs: loadedTeamChannelsReloadStaleMs,
  })

  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clear(validTeamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clear(validTeamID)
    }
  })

  return {...data, loading, reload}
}

export const LoadedTeamChannelsProvider = (
  props: React.PropsWithChildren<{teamID: T.Teams.TeamID; teamname?: string}>
) => {
  const {children, teamID, teamname} = props
  const [cacheMap] = React.useState<LoadedTeamChannelsCacheMap>(() => new Map())
  const loadedTeamChannels = useLoadedTeamChannelsRaw(teamID, teamname, true, cacheMap)
  const value = {...loadedTeamChannels, teamID}
  return (
    <LoadedTeamChannelsCacheContext.Provider value={cacheMap}>
      <LoadedTeamChannelsContext.Provider value={value}>{children}</LoadedTeamChannelsContext.Provider>
    </LoadedTeamChannelsCacheContext.Provider>
  )
}

export const useLoadedTeamChannels = (
  teamID: T.Teams.TeamID,
  teamname?: string
): LoadedTeamChannels => {
  const context = React.useContext(LoadedTeamChannelsContext)
  const useContextValue = context?.teamID === teamID
  const raw = useLoadedTeamChannelsRaw(teamID, teamname, !useContextValue)
  return useContextValue ? context : raw
}
