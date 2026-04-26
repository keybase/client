import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import logger from '@/logger'
import {ensureError} from '@/util/errors'
import {useEngineActionListener} from '@/engine/action-listener'
import {useLoadedTeam} from '../team/use-loaded-team'
import {createCachedResourceCache, type CachedResourceCache, useCachedResource} from '../use-cached-resource'

type ChannelMetasData = {
  channelMetas: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
}

const allChannelMetasReloadStaleMs = 5_000

// Filter bots out using team role info, isolate to only when related state changes
export const useChannelParticipants = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey
) => {
  const participants = ConvoState.useConvoState(conversationIDKey, s => s.participants.all)
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
  const initialData = React.useMemo(
    () => ({channelMetas: emptyChannelMetas}),
    [emptyChannelMetas]
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
          ({convs}) =>
            resolve({
              channelMetas: new Map(
                (convs ?? [])
                  .map(conv => Chat.inboxUIItemToConversationMeta(conv))
                  .reduce((arr, a) => {
                    if (a) {
                      arr.push([a.conversationIDKey, a])
                    }
                    return arr
                  }, new Array<[string, T.Chat.ConversationMeta]>())
              ),
            }),
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
    loadingChannels: (!dontCallRPC && !teamname) || loading,
    reloadChannels: reload,
  }
}
