import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as React from 'react'
import {useLoadedTeam} from '../team/use-loaded-team'
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '../use-cached-resource'

type LoadedTeamChannels = {
  channels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>
  channelParticipants: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>
  loading: boolean
  reload: () => Promise<void>
}

type LoadedTeamChannelsContextValue = LoadedTeamChannels & {
  teamID: T.Teams.TeamID
}

type LoadedTeamChannelsData = Pick<LoadedTeamChannels, 'channels' | 'channelParticipants'>
type LoadedTeamChannelsCacheMap = Map<
  T.Teams.TeamID | undefined,
  CachedResourceCache<LoadedTeamChannelsData, T.Teams.TeamID | undefined>
>

const LoadedTeamChannelsContext = React.createContext<LoadedTeamChannelsContextValue | null>(null)
const LoadedTeamChannelsCacheContext = React.createContext<LoadedTeamChannelsCacheMap | null>(null)
const loadedTeamChannelsReloadStaleMs = 5_000

const emptyChannels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo> = new Map()
const emptyChannelParticipants: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo> = new Map()

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamChannelsData: LoadedTeamChannelsData = {
  channelParticipants: emptyChannelParticipants,
  channels: emptyChannels,
}

// forceLocalCache: a disabled "shadow" instance (one that returns the context
// value instead of its own) must NOT share the loader's cache map. With enabled=false
// useCachedResource resets the cache (loadedAt=0), which would clobber the loader's
// loaded data. Give shadows a private throwaway map so their resets are harmless.
const useLoadedTeamChannelsCacheMap = (
  providedCacheMap?: LoadedTeamChannelsCacheMap,
  forceLocalCache = false
) => {
  const contextCacheMap = React.useContext(LoadedTeamChannelsCacheContext)
  const [localCacheMap] = React.useState<LoadedTeamChannelsCacheMap>(() => new Map())
  if (forceLocalCache) {
    return localCacheMap
  }
  return providedCacheMap ?? contextCacheMap ?? localCacheMap
}

const useLoadedTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  providedTeamname?: string,
  enabled = true,
  providedCacheMap?: LoadedTeamChannelsCacheMap,
  forceLocalCache = false
): LoadedTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const {
    teamMeta: {teamname: loadedTeamname},
  } = useLoadedTeam(teamID, enabled)
  const teamnameToLoad = providedTeamname || loadedTeamname
  const cacheMap = useLoadedTeamChannelsCacheMap(providedCacheMap, forceLocalCache)
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
      const channelParticipants = new Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>()
      const channels =
        convs?.reduce((res, inboxUIItem) => {
          const conversationIDKey = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
          res.set(conversationIDKey, {
            channelname: inboxUIItem.channel,
            conversationIDKey,
            description: inboxUIItem.headline,
          })
          channelParticipants.set(
            conversationIDKey,
            Chat.uiParticipantsToParticipantInfo(inboxUIItem.participants ?? [])
          )
          return res
        }, new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()) ??
        new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()

      return {
        channelParticipants,
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
  const raw = useLoadedTeamChannelsRaw(teamID, teamname, !useContextValue, undefined, useContextValue)
  return useContextValue ? context : raw
}

// A team is "big" once it has channels beyond #general. Derive it from this
// team's own channels (loaded here / via the screen's provider) rather than the
// chat inbox layout, which is empty until the inbox has been visited — so the
// answer is correct on first entry without depending on any other screen.
export const useIsBigTeam = (teamID: T.Teams.TeamID): boolean => {
  const {channels} = useLoadedTeamChannels(teamID)
  return channels.size > 1
}
