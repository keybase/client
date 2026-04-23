import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import {useLoadedTeam} from '../team/use-loaded-team'
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '../use-cached-resource'

type ChannelMetasData = {
  channelMetas: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
}

const allChannelMetasCache = new Map<T.Teams.TeamID, CachedResourceCache<ChannelMetasData, T.Teams.TeamID>>()

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
  const emptyChannelMetas = React.useMemo(
    () => new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>(),
    []
  )
  const channelMetasCache = React.useMemo(
    () => getCachedResourceCache(allChannelMetasCache, {channelMetas: emptyChannelMetas}, teamID),
    [emptyChannelMetas, teamID]
  )
  const {data, loading, reload} = useCachedResource({
    cache: channelMetasCache,
    cacheKey: teamID,
    enabled: !dontCallRPC && !!teamname,
    initialData: {channelMetas: emptyChannelMetas},
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
          error => reject(error)
        )
      }),
    refreshKey: teamname,
    staleMs: 0,
  })

  return {
    channelMetas: data.channelMetas,
    loadingChannels: (!dontCallRPC && !teamname) || loading,
    reloadChannels: reload,
  }
}
