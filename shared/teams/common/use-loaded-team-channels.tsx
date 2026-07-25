import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as React from 'react'
import {registerExternalResetter} from '@/util/zustand'
import {registerTeamChannelsInvalidator} from './team-channels-invalidation'
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
const loadedTeamChannelsReloadStaleMs = 5_000

const emptyChannels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo> = new Map()
const emptyChannelParticipants: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo> = new Map()

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamChannelsData: LoadedTeamChannelsData = {
  channelParticipants: emptyChannelParticipants,
  channels: emptyChannels,
}

// One map for every consumer. The stale window and the single-flight both live on
// the cache object, so callers holding separate maps cannot see each other's
// in-flight request and each issue their own getTLFConversationsLocal - which
// localizes every channel in the team. Measured at 7 calls for one team inside
// 1.5s before this was shared.
const loadedTeamChannelsCache: LoadedTeamChannelsCacheMap = new Map()
const loadedTeamChannelsInvalidationListeners = new Set<(teamID: T.Teams.TeamID | undefined) => void>()

// module scope outlives sign-out and this is per-user team data
registerExternalResetter('loaded-team-channels-cache', () => {
  loadedTeamChannelsCache.forEach(cache => cache.reset(emptyLoadedTeamChannelsData, undefined))
  loadedTeamChannelsCache.clear()
})

// While every consumer held a private cache a remount happened to refetch, which
// is what the channel list relied on after a create. Sharing one cache means a
// remount inside the stale window serves the pre-change channels instead, so the
// create/delete screens have to drop this explicitly.
registerTeamChannelsInvalidator((teamID: T.Teams.TeamID) => {
  const key = loadableTeamID(teamID)
  loadedTeamChannelsCache.get(key)?.invalidate(key)
  loadedTeamChannelsInvalidationListeners.forEach(listener => listener(key))
})

// forceLocalCache: a disabled "shadow" instance (one that returns the context
// value instead of its own) must NOT share the loader's cache map. With enabled=false
// useCachedResource resets the cache (loadedAt=0), which would clobber the loader's
// loaded data. Give shadows a private throwaway map so their resets are harmless.
const useLoadedTeamChannelsCacheMap = (forceLocalCache: boolean) => {
  const [localCacheMap] = React.useState<LoadedTeamChannelsCacheMap>(() => new Map())
  return forceLocalCache ? localCacheMap : loadedTeamChannelsCache
}

export const teamChannelsRPCParams = (teamname: string) => ({
  membersType: T.RPCChat.ConversationMembersType.team,
  tlfName: teamname,
  topicType: T.RPCChat.TopicType.chat,
})

// keep a team's channel list fresh: reload on team changes, drop it when the
// team is deleted or left
export const useReloadOnTeamChannelChanges = (
  teamID: T.Teams.TeamID | undefined,
  enabled: boolean,
  reload: () => unknown,
  clear: () => void
) => {
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && action.payload.params.teamID === teamID) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && action.payload.params.teamID === teamID) {
      clear()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === teamID) {
      clear()
    }
  })
}

const useLoadedTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  providedTeamname?: string,
  enabled = true,
  forceLocalCache = false
): LoadedTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const {
    teamMeta: {teamname: loadedTeamname},
  } = useLoadedTeam(teamID, enabled)
  const teamnameToLoad = providedTeamname || loadedTeamname
  // useCachedResource resets whatever cache it holds while disabled, so a
  // disabled instance must never hold the shared one — including the ordinary
  // consumer whose teamname has not resolved yet, which would otherwise wipe a
  // real loader's data mid-flight. Gate the cache on exactly the load condition.
  const canLoad = enabled && !!validTeamID && !!teamnameToLoad
  const cacheMap = useLoadedTeamChannelsCacheMap(forceLocalCache || !canLoad)
  const cache = React.useMemo(
    () => getCachedResourceCache(cacheMap, emptyLoadedTeamChannelsData, validTeamID),
    [cacheMap, validTeamID]
  )
  const {data, loading, reload, clear} = useCachedResource({
    cache,
    cacheKey: validTeamID,
    enabled: canLoad,
    initialData: emptyLoadedTeamChannelsData,
    load: async () => {
      if (!teamnameToLoad) {
        return emptyLoadedTeamChannelsData
      }
      const teamIDToLoad = validTeamID ?? T.Teams.noTeamID
      const teamname = teamnameToLoad
      const {convs} = await T.RPCChat.localGetTLFConversationsLocalRpcPromise(
        teamChannelsRPCParams(teamname),
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

  useReloadOnTeamChannelChanges(validTeamID, enabled, reload, () => clear(validTeamID))

  // a mounted list must pick up an invalidation too, not just the next mount
  React.useEffect(() => {
    if (!enabled || !validTeamID) {
      return
    }
    const listener = (invalidatedTeamID: T.Teams.TeamID | undefined) => {
      if (invalidatedTeamID === validTeamID) {
        void reload()
      }
    }
    loadedTeamChannelsInvalidationListeners.add(listener)
    return () => {
      loadedTeamChannelsInvalidationListeners.delete(listener)
    }
  }, [enabled, validTeamID, reload])

  const {channelParticipants, channels} = data
  return React.useMemo(
    () => ({channelParticipants, channels, loading, reload}),
    [channelParticipants, channels, loading, reload]
  )
}

export const LoadedTeamChannelsProvider = (
  props: React.PropsWithChildren<{teamID: T.Teams.TeamID; teamname?: string}>
) => {
  const {children, teamID, teamname} = props
  const loadedTeamChannels = useLoadedTeamChannelsRaw(teamID, teamname, true)
  const value = React.useMemo(
    () => ({...loadedTeamChannels, teamID}),
    [loadedTeamChannels, teamID]
  )
  return <LoadedTeamChannelsContext.Provider value={value}>{children}</LoadedTeamChannelsContext.Provider>
}

export const useLoadedTeamChannels = (
  teamID: T.Teams.TeamID,
  teamname?: string
): LoadedTeamChannels => {
  const context = React.useContext(LoadedTeamChannelsContext)
  const useContextValue = context?.teamID === teamID
  const raw = useLoadedTeamChannelsRaw(teamID, teamname, !useContextValue, useContextValue)
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
