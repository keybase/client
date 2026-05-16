import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as React from 'react'
import logger from '@/logger'
import {ensureError} from '@/util/errors'
import {useEngineActionListener} from '@/engine/action-listener'
import {useLoadedTeam} from '../team/use-loaded-team'
import {createCachedResourceCache, type CachedResourceCache, useCachedResource} from '../use-cached-resource'
import {useLoadedTeamChannels} from './use-loaded-team-channels'

type ChannelMetasData = {
  channelMetas: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  channelParticipants: Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>
}

const allChannelMetasReloadStaleMs = 5_000

// Filter bots out using team role info, isolate to only when related state changes
export const useChannelParticipants = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey
) => {
  const {channelParticipants} = useLoadedTeamChannels(teamID)
  const participants = channelParticipants.get(conversationIDKey)?.all ?? []
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
  const emptyChannelMetas = React.useMemo(
    () => new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>(),
    []
  )
  const emptyChannelParticipants = React.useMemo(
    () => new Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>(),
    []
  )
  const initialData = React.useMemo(
    () => ({channelMetas: emptyChannelMetas, channelParticipants: emptyChannelParticipants}),
    [emptyChannelMetas, emptyChannelParticipants]
  )
  const [channelMetasCache] = React.useState<CachedResourceCache<ChannelMetasData, T.Teams.TeamID>>(
    () => createCachedResourceCache(initialData, teamID)
  )
  const {data, loading, reload, clear} = useCachedResource({
    cache: channelMetasCache,
    cacheKey: teamID,
    enabled,
    initialData,
    load: async () =>
      new Promise<ChannelMetasData>((resolve, reject) => {
        getConversations(
          [
            {
              membersType: T.RPCChat.ConversationMembersType.team,
              tlfName: teamname,
              topicType: T.RPCChat.TopicType.chat,
            },
            C.waitingKeyTeamsGetChannels(teamID),
          ],
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

  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (action.payload.params.teamID === teamID) {
      void reload()
    }
  }, enabled)
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (action.payload.params.teamID === teamID) {
      clear(teamID)
    }
  }, enabled)
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (action.payload.params.teamID === teamID) {
      clear(teamID)
    }
  }, enabled)

  return {
    channelMetas: data.channelMetas,
    channelParticipants: data.channelParticipants,
    loadingChannels: (!dontCallRPC && !teamname) || loading,
    reloadChannels: reload,
  }
}
