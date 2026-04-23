import * as C from '@/constants'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as React from 'react'
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

const LoadedTeamChannelsContext = React.createContext<LoadedTeamChannelsContextValue | null>(null)
const loadedTeamChannelsReloadStaleMs = 0
const loadedTeamChannelsCache = new Map<
  T.Teams.TeamID | undefined,
  CachedResourceCache<LoadedTeamChannelsData, T.Teams.TeamID | undefined>
>()

const emptyChannels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo> = new Map()

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamChannelsData: LoadedTeamChannelsData = {channels: emptyChannels}

const loadTeamname = async (teamID: T.Teams.TeamID, teamname?: string) => {
  if (teamname) {
    return teamname
  }
  const annotatedTeam = await T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID})
  return annotatedTeam.name
}

const useLoadedTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  providedTeamname?: string,
  enabled = true
): LoadedTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const cache = React.useMemo(
    () => getCachedResourceCache(loadedTeamChannelsCache, emptyLoadedTeamChannelsData, validTeamID),
    [validTeamID]
  )
  const {data, loading, reload, clear} = useCachedResource({
    cache,
    cacheKey: validTeamID,
    enabled: enabled && !!validTeamID,
    initialData: emptyLoadedTeamChannelsData,
    load: async () => {
      const teamIDToLoad = validTeamID ?? T.Teams.noTeamID
      const teamname = await loadTeamname(teamIDToLoad, providedTeamname)
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

      for (const channel of channels.values()) {
        C.ignorePromise(
          T.RPCChat.localRefreshParticipantsRpcPromise({
            convID: T.Chat.keyToConversationID(channel.conversationIDKey),
          })
        )
      }

      return {
        channels,
      }
    },
    onError: error => {
      logger.warn(`Failed to load team channels for ${validTeamID}`, error)
    },
    refreshKey: providedTeamname,
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
  const loadedTeamChannels = useLoadedTeamChannelsRaw(teamID, teamname)
  const value = {...loadedTeamChannels, teamID}
  return <LoadedTeamChannelsContext.Provider value={value}>{children}</LoadedTeamChannelsContext.Provider>
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
