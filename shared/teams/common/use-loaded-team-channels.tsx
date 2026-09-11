import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import * as React from 'react'
import type * as EngineGen from '@/constants/rpc'
import {registerTeamChannelsInvalidator} from './team-channels-invalidation'
import {useLoadedTeam} from '../team/use-loaded-team'
import {
  type CachedResourceInvalidation,
  createCachedResourceNamespace,
  useCachedResource,
} from '@/util/use-cached-resource'

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
const LoadedTeamChannelsContext = React.createContext<LoadedTeamChannelsContextValue | null>(null)
const loadedTeamChannelsReloadStaleMs = 5_000

const emptyChannels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo> = new Map()
const emptyChannelMetas: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ConversationMeta> = new Map()
const emptyChannelParticipants: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo> = new Map()

// teamChangedByID fires for every incoming message in a team and reloads this,
// and the result is nearly always identical to what is already cached. A fresh
// Map each time gives the memo below a new identity, which wakes every consumer
// of the context value - the cost this shared cache exists to remove. Reuse the
// previous Map when nothing changed, and the previous entries when only some
// did, so downstream memos can bail too.
const recycleMap = <K, V>(old: ReadonlyMap<K, V>, next: Map<K, V>): ReadonlyMap<K, V> => {
  let unchanged = old.size === next.size
  for (const [key, value] of next) {
    const previous = old.get(key)
    if (previous !== undefined && isEqual(previous, value)) {
      if (previous !== value) {
        next.set(key, previous)
      }
    } else {
      unchanged = false
    }
  }
  return unchanged ? old : next
}

// nothing moved at all: hand back the very object the cache already holds, so
// useCachedResource settles without a state change
const recycleChannels = (
  previous: LoadedTeamChannelsData,
  next: LoadedTeamChannelsData
): LoadedTeamChannelsData => {
  const recycled = {
    channelMetas: recycleMap(previous.channelMetas, new Map(next.channelMetas)),
    channelParticipants: recycleMap(previous.channelParticipants, new Map(next.channelParticipants)),
    channels: recycleMap(previous.channels, new Map(next.channels)),
  }
  return recycled.channelMetas === previous.channelMetas &&
    recycled.channelParticipants === previous.channelParticipants &&
    recycled.channels === previous.channels
    ? previous
    : recycled
}

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamChannelsData: LoadedTeamChannelsData = {
  channelMetas: emptyChannelMetas,
  channelParticipants: emptyChannelParticipants,
  channels: emptyChannels,
}

// One entry per team. The stale window and the single-flight both live on the
// entry, so consumers holding separate ones cannot see each other's in-flight
// request and each issue their own getTLFConversationsLocal - which localizes
// every channel in the team. Measured at 7 calls for one team inside 1.5s before
// this was shared.
const loadedTeamChannels = createCachedResourceNamespace<LoadedTeamChannelsData, T.Teams.TeamID>(
  'loaded-team-channels-cache',
  () => emptyLoadedTeamChannelsData
)

// Creating or deleting a channel fires no teamChangedByID, and a remount inside
// the stale window would serve the pre-change channels, so the create/delete
// screens drop the entry explicitly.
registerTeamChannelsInvalidator((teamID: T.Teams.TeamID) => {
  const key = loadableTeamID(teamID)
  if (key) {
    loadedTeamChannels.invalidate(key)
  }
})

export const teamChannelsRPCParams = (teamname: string) => ({
  membersType: T.RPCChat.ConversationMembersType.team,
  tlfName: teamname,
  topicType: T.RPCChat.TopicType.chat,
})

// keep a team's channel list fresh: reload on team changes, drop it when the
// team is deleted or left
const teamChannelInvalidations = (teamID: T.Teams.TeamID | undefined) =>
  [
    {
      type: 'keybase.1.NotifyTeam.teamChangedByID',
      when: (action: EngineGen.Actions) =>
        (action as EngineGen.ActionOf<'keybase.1.NotifyTeam.teamChangedByID'>).payload.params.teamID ===
        teamID,
    },
    {
      effect: 'clear',
      type: 'keybase.1.NotifyTeam.teamDeleted',
      when: (action: EngineGen.Actions) =>
        (action as EngineGen.ActionOf<'keybase.1.NotifyTeam.teamDeleted'>).payload.params.teamID === teamID,
    },
    {
      effect: 'clear',
      type: 'keybase.1.NotifyTeam.teamExit',
      when: (action: EngineGen.Actions) =>
        (action as EngineGen.ActionOf<'keybase.1.NotifyTeam.teamExit'>).payload.params.teamID === teamID,
    },
  ] satisfies ReadonlyArray<CachedResourceInvalidation>

const useLoadedTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  providedTeamname?: string,
  enabled = true
): LoadedTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const {
    teamMeta: {teamname: loadedTeamname},
  } = useLoadedTeam(teamID, enabled)
  const teamnameToLoad = providedTeamname || loadedTeamname
  const {data, loading, reload} = useCachedResource({
    cacheKey: validTeamID,
    enabled: enabled && !!teamnameToLoad,
    initialData: emptyLoadedTeamChannelsData,
    invalidateOn: teamChannelInvalidations(validTeamID),
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
    namespace: loadedTeamChannels,
    onError: error => {
      logger.warn(`Failed to load team channels for ${validTeamID}`, error)
    },
    recycle: recycleChannels,
    refreshKey: teamnameToLoad,
    staleMs: loadedTeamChannelsReloadStaleMs,
  })

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
  const channels = useLoadedTeamChannelsRaw(teamID, teamname, true)
  const value = React.useMemo(() => ({...channels, teamID}), [channels, teamID])
  return <LoadedTeamChannelsContext.Provider value={value}>{children}</LoadedTeamChannelsContext.Provider>
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
