import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as React from 'react'
import logger from '@/logger'
import {ensureError} from '@/util/errors'
import {useLoadedTeam} from '../team/use-loaded-team'
import {
  createCachedResourceCache,
  type CachedResourceCache,
  getCachedResourceCache,
  useCachedResource,
} from '../use-cached-resource'
import {
  teamChannelsRPCParams,
  useLoadedTeamChannels,
  useReloadOnTeamChannelChanges,
} from './use-loaded-team-channels'

type ChannelMetasData = {
  channelMetas: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  channelParticipants: Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>
}

const allChannelMetasReloadStaleMs = 5_000

const emptyChannelMetas = new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>()
const emptyChannelParticipants = new Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>()
const emptyChannelMetasData: ChannelMetasData = {
  channelMetas: emptyChannelMetas,
  channelParticipants: emptyChannelParticipants,
}

// One cache per team, shared by every consumer: getTLFConversations makes the
// service localize (and remotely refresh participants for) every channel in the
// team, so a per-instance cache turns each extra mount into a full refetch —
// enough of them trips the server's chat rate limit on a big team.
const allChannelMetasCaches = new Map<
  T.Teams.TeamID,
  CachedResourceCache<ChannelMetasData, T.Teams.TeamID>
>()

// Filter bots out using team role info, isolate to only when related state changes
export const useChannelParticipants = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey,
  // Team channel participants are empty in the getTLFConversations result (the Go
  // localizer leaves Info.Participants empty for team convs); they arrive async via
  // ChatParticipantsInfo in useInboxMetadataState. Callers that can safely import
  // chat/inbox state (leaf screens, not this require-cycle module) pass it here.
  inboxParticipants?: T.Immutable<T.Chat.ParticipantInfo>
) => {
  const {channelParticipants} = useLoadedTeamChannels(teamID)
  const participants = inboxParticipants?.all ?? channelParticipants.get(conversationIDKey)?.all ?? []
  const {
    teamDetails: {members: teamMembers},
  } = useLoadedTeam(teamID)
  return participants.filter(username => {
    const maybeMember = teamMembers.get(username)
    return maybeMember && maybeMember.type !== 'bot' && maybeMember.type !== 'restrictedbot'
  })
}

export const useAllChannelMetas = (
  teamID: T.Teams.TeamID,
  dontCallRPC?: boolean
): {
  channelMetas: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  channelParticipants: Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>
  loadingChannels: boolean
  reloadChannels: () => Promise<void>
} => {
  const getConversations = C.useRPC(T.RPCChat.localGetTLFConversationsLocalRpcPromise)
  const {
    teamMeta: {teamname},
  } = useLoadedTeam(teamID)
  const enabled = !dontCallRPC && !!teamname
  const initialData = emptyChannelMetasData
  // a dontCallRPC instance is disabled, and useCachedResource resets the cache it
  // holds when disabled — give those their own throwaway cache so they can't wipe
  // the shared one out from under a real loader
  const [localCache] = React.useState<CachedResourceCache<ChannelMetasData, T.Teams.TeamID>>(() =>
    createCachedResourceCache(initialData, teamID)
  )
  const sharedCache = React.useMemo(
    () => getCachedResourceCache(allChannelMetasCaches, initialData, teamID),
    [initialData, teamID]
  )
  const channelMetasCache = dontCallRPC ? localCache : sharedCache
  const {data, loading, reload, clear} = useCachedResource({
    cache: channelMetasCache,
    cacheKey: teamID,
    enabled,
    initialData,
    load: async () =>
      new Promise<ChannelMetasData>((resolve, reject) => {
        getConversations(
          [teamChannelsRPCParams(teamname), C.waitingKeyTeamsGetChannels(teamID)],
          ({convs}) => {
            const channelMetas = new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>()
            const channelParticipants = new Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>()
            const loadedConvs = convs ?? []
            loadedConvs.forEach(conv => {
              const meta = Chat.inboxUIItemToConversationMeta(conv)
              if (!meta) {
                return
              }
              const conversationIDKey = meta.conversationIDKey
              channelMetas.set(conversationIDKey, meta)
              channelParticipants.set(
                conversationIDKey,
                Chat.uiParticipantsToParticipantInfo(conv.participants ?? [])
              )
            })
            resolve({
              channelMetas,
              channelParticipants,
            })
          },
          error => reject(ensureError(error))
        )
      }),
    onError: error => {
      logger.warn(`Failed to load all channel metas for ${teamID}`, error)
    },
    refreshKey: teamname,
    staleMs: allChannelMetasReloadStaleMs,
  })

  useReloadOnTeamChannelChanges(teamID, enabled, reload, () => clear(teamID))

  return {
    channelMetas: data.channelMetas,
    channelParticipants: data.channelParticipants,
    loadingChannels: (!dontCallRPC && !teamname) || loading,
    reloadChannels: reload,
  }
}
