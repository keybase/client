import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import {subscribeToEngineAction} from '@/engine/action-listener'
import logger from '@/logger'
import * as React from 'react'
import {registerExternalResetter} from '@/util/zustand'
import {useLoadedTeam} from '../team/use-loaded-team'
import {makeTeamReloadDebouncer, teamGone} from '../use-team-changed'
import {forgetLoad, markLoadStale, reviveLoad, useLoadData} from '@/query'

type LoadedTeamChannels = {
  channels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>
  // the full meta for each channel, derived from the same getTLFConversations
  // result. This used to be a second module cache issuing the same RPC with the
  // same arguments, which the two caches could not dedupe between - measured as
  // pairs of identical calls microseconds apart, each fanning out to one remote
  // participant refresh per channel in the team.
  channelMetas: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  channelParticipants: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>
  loading: boolean
  reload: () => Promise<void>
}

type LoadedTeamChannelsContextValue = LoadedTeamChannels & {
  teamID: T.Teams.TeamID
}

type LoadedTeamChannelsData = Pick<
  LoadedTeamChannels,
  'channels' | 'channelMetas' | 'channelParticipants'
>

export const LoadedTeamChannelsContext = React.createContext<LoadedTeamChannelsContextValue | null>(null)
const loadedTeamChannelsReloadStaleMs = 5_000

const emptyChannels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo> = new Map()
const emptyChannelMetas: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ConversationMeta> = new Map()
const emptyChannelParticipants: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo> = new Map()

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamChannelsData: LoadedTeamChannelsData = {
  channelMetas: emptyChannelMetas,
  channelParticipants: emptyChannelParticipants,
  channels: emptyChannels,
}

// One cache entry per team for every consumer: each load is a getTLFConversationsLocal,
// which localizes every channel in the team.
//
// A reload after a team change is nearly always identical to what is already
// cached: the cache keeps the previous Maps when nothing changed, and the previous
// entries when only some did, so downstream memos can bail.
const loadedTeamChannelsLoad = 'teams.loadedTeamChannels'

// Teams whose channels this session loaded: the only ones a notice has anything to reload
const loadedTeams = new Set<T.Teams.TeamID>()
const teamChannelsChangedDebouncer = makeTeamReloadDebouncer(teamID =>
  reviveLoad(loadedTeamChannelsLoad, teamID)
)

// module scope outlives sign-out and this is per-user team data
registerExternalResetter('loaded-team-channels', () => {
  teamChannelsChangedDebouncer.cancelAll()
  loadedTeams.clear()
})

// Reload a team's channel list wherever it is shown, and mark it stale where it is not, coalescing
// a burst (a bulk create or delete sends one notice per channel). A team whose channels were never
// loaded has nothing to reload, so it schedules nothing.
export const invalidateTeamChannels = (teamID: T.Teams.TeamID) => {
  const key = loadableTeamID(teamID)
  if (key && loadedTeams.has(key)) {
    teamChannelsChangedDebouncer.schedule(key)
  }
}

// Module scope, not per hook: a change that lands while no list is mounted must
// still mark the shared entry stale, or a remount inside the stale window serves the
// pre-change channels.
// Membership is in: each channel's participants come with the list.
subscribeToEngineAction('keybase.1.NotifyTeam.teamChanged', action => {
  const {kinds, teamID} = action.payload.params
  const key = loadableTeamID(teamID)
  if (!key) {
    return
  }
  if (teamGone(kinds)) {
    teamChannelsChangedDebouncer.cancel(key)
    forgetLoad(loadedTeamChannelsLoad, key)
  } else if (kinds.channels || kinds.membership) {
    invalidateTeamChannels(key)
  } else if (kinds.renamed) {
    // the list is fetched by teamname and its metas carry it. Mounted lists
    // reload once their teamname turns into the new one (refreshKey), which this
    // makes stale; reloading them now would refetch under the old name.
    markLoadStale(loadedTeamChannelsLoad, key)
  }
})

const teamChannelsRPCParams = (teamname: string) => ({
  membersType: T.RPCChat.ConversationMembersType.team,
  tlfName: teamname,
  topicType: T.RPCChat.TopicType.chat,
})

const useLoadedTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  providedTeamname?: string,
  enabled = true
): LoadedTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const teamIDToLoad = validTeamID ?? T.Teams.noTeamID
  const {
    teamMeta: {teamname: loadedTeamname},
  } = useLoadedTeam(teamID, enabled)
  const teamnameToLoad = providedTeamname || loadedTeamname
  const canLoad = enabled && !!validTeamID && !!teamnameToLoad
  const {
    data = emptyLoadedTeamChannelsData,
    loading,
    reloadAndWait: reload,
  } = useLoadData(
    loadedTeamChannelsLoad,
    teamIDToLoad,
    async (signal): Promise<LoadedTeamChannelsData> => {
      loadedTeams.add(teamIDToLoad)
      const {convs} = await T.RPCChat.localGetTLFConversationsLocalRpcPromise(
        teamChannelsRPCParams(teamnameToLoad),
        C.waitingKeyTeamsGetChannels(teamIDToLoad),
        signal
      )
      const channels = new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()
      const channelMetas = new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>()
      const channelParticipants = new Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>()
      for (const inboxUIItem of convs ?? []) {
        const conversationIDKey = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
        channels.set(conversationIDKey, {
          channelname: inboxUIItem.channel,
          conversationIDKey,
          description: inboxUIItem.headline,
        })
        channelParticipants.set(
          conversationIDKey,
          Chat.uiParticipantsToParticipantInfo(inboxUIItem.participants ?? [])
        )
        const meta = Chat.inboxUIItemToConversationMeta(inboxUIItem)
        if (meta) {
          channelMetas.set(meta.conversationIDKey, meta)
        }
      }
      return {channelMetas, channelParticipants, channels}
    },
    {
      enabled: canLoad,
      onError: error => logger.warn(`Failed to load team channels for ${teamIDToLoad}`, error),
      refreshKey: teamnameToLoad,
      staleMs: loadedTeamChannelsReloadStaleMs,
    }
  )

  const {channelMetas, channelParticipants, channels} = data
  return React.useMemo(
    () => ({channelMetas, channelParticipants, channels, loading, reload}),
    [channelMetas, channelParticipants, channels, loading, reload]
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
  return <LoadedTeamChannelsContext value={value}>{children}</LoadedTeamChannelsContext>
}

export const useLoadedTeamChannels = (
  teamID: T.Teams.TeamID,
  teamname?: string,
  enabled = true
): LoadedTeamChannels => {
  const context = React.useContext(LoadedTeamChannelsContext)
  // a disabled consumer still reads a provider's already-loaded value when there
  // is one - it only must not issue a load of its own
  const useContextValue = context?.teamID === teamID
  const raw = useLoadedTeamChannelsRaw(teamID, teamname, enabled && !useContextValue)
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
