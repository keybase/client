import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as React from 'react'
import {registerTeamChannelsInvalidator} from './team-channels-invalidation'
import {useLoadedTeam} from '../team/use-loaded-team'
import {forgetLoad, refreshLoad, useLoadData} from '@/query'

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

// One cache entry per team for every consumer. The stale window and the single-flight
// both live on the entry, so callers holding separate caches cannot see each other's
// in-flight request and each issue their own getTLFConversationsLocal - which
// localizes every channel in the team. Measured at 7 calls for one team inside
// 1.5s before this was shared.
//
// teamChangedByID fires for every incoming message in a team and reloads this, and
// the result is nearly always identical to what is already cached: the cache keeps
// the previous Maps when nothing changed, and the previous entries when only some
// did, so downstream memos can bail.
const loadedTeamChannelsLoad = 'teams.loadedTeamChannels'

// A remount inside the stale window serves the cached channels, so the
// create/delete screens have to say the list changed.
registerTeamChannelsInvalidator((teamID: T.Teams.TeamID) => {
  refreshLoad(loadedTeamChannelsLoad, loadableTeamID(teamID) ?? T.Teams.noTeamID)
})

const teamChannelsRPCParams = (teamname: string) => ({
  membersType: T.RPCChat.ConversationMembersType.team,
  tlfName: teamname,
  topicType: T.RPCChat.TopicType.chat,
})

// keep a team's channel list fresh: reload on team changes, drop it when the
// team is deleted or left
const useReloadOnTeamChannelChanges = (teamID: T.Teams.TeamID, enabled: boolean) => {
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && action.payload.params.teamID === teamID) {
      refreshLoad(loadedTeamChannelsLoad, teamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && action.payload.params.teamID === teamID) {
      forgetLoad(loadedTeamChannelsLoad, teamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === teamID) {
      forgetLoad(loadedTeamChannelsLoad, teamID)
    }
  })
}

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
    error,
    loading,
    reloadAndWait: reload,
  } = useLoadData(
    loadedTeamChannelsLoad,
    teamIDToLoad,
    async (signal): Promise<LoadedTeamChannelsData> => {
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
    {enabled: canLoad, refreshKey: teamnameToLoad, staleMs: loadedTeamChannelsReloadStaleMs}
  )
  React.useEffect(() => {
    if (error) {
      logger.warn(`Failed to load team channels for ${teamIDToLoad}`, error)
    }
  }, [error, teamIDToLoad])

  useReloadOnTeamChannelChanges(teamIDToLoad, enabled && !!validTeamID)

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
