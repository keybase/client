import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import {useLoadedTeam} from '../team/use-loaded-team'

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
  const [channelMetas, setChannelMetas] = React.useState(
    new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>()
  )

  const [loadingChannels, setLoadingChannels] = React.useState(true)

  const getConversationsRef = React.useRef(getConversations)
  const teamnameRef = React.useRef(teamname)
  const teamIDRef = React.useRef(teamID)
  React.useEffect(() => {
    getConversationsRef.current = getConversations
    teamnameRef.current = teamname
    teamIDRef.current = teamID
  }, [getConversations, teamname, teamID])

  const [reloadChannels] = React.useState(() => async () =>
      new Promise<void>((resolve, reject) => {
        setLoadingChannels(true)
        getConversationsRef.current(
          [
            {
              membersType: T.RPCChat.ConversationMembersType.team,
              tlfName: teamnameRef.current,
              topicType: T.RPCChat.TopicType.chat,
            },
            C.waitingKeyTeamsGetChannels(teamIDRef.current),
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
  )

  React.useEffect(() => {
    if (!dontCallRPC) {
      reloadChannels()
        .then(() => {})
        .catch(() => {})
    }
  }, [reloadChannels, dontCallRPC])

  return {channelMetas, loadingChannels, reloadChannels}
}
