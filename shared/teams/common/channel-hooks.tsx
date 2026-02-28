import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import * as Teams from '@/stores/teams'

// Filter bots out using team role info, isolate to only when related state changes
export const useChannelParticipants = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey
) => {
  const participants = Chat.useConvoState(conversationIDKey, s => s.participants.all)
  const teamMembers = Teams.useTeamsState(s => s.teamDetails.get(teamID)?.members)
  return participants.filter(username => {
        const maybeMember = teamMembers?.get(username)
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

  const teamname = Teams.useTeamsState(s => Teams.getTeamNameFromID(s, teamID) ?? '')
  const [channelMetas, setChannelMetas] = React.useState(
    new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>()
  )

  const [loadingChannels, setLoadingChannels] = React.useState(true)

  const reloadChannels = async () =>
      new Promise<void>((resolve, reject) => {
        setLoadingChannels(true)
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
            resolve()
            if (convs) {
              setChannelMetas(
                new Map(
                  convs
                    .map(conv => Chat.inboxUIItemToConversationMeta(conv))
                    .reduce((arr, a) => {
                      if (a) {
                        arr.push([a.conversationIDKey, a])
                      }
                      return arr
                    }, new Array<[string, T.Chat.ConversationMeta]>())
                )
              )
            }

            setLoadingChannels(false)
          },
          error => {
            setLoadingChannels(false)
            reject(error)
          }
        )
      })

  const reloadChannelsRef = React.useRef(reloadChannels)
  React.useEffect(() => {
    reloadChannelsRef.current = reloadChannels
  })

  React.useEffect(() => {
    if (!dontCallRPC) {
      reloadChannelsRef.current()
        .then(() => {})
        .catch(() => {})
    }
  }, [dontCallRPC])

  return {channelMetas, loadingChannels, reloadChannels}
}
