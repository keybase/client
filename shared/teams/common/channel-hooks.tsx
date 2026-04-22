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
  type ChannelMetasState = {
    channelMetas: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
    loadedTeamID?: T.Teams.TeamID
    loadingChannels: boolean
  }

  const getConversations = C.useRPC(T.RPCChat.localGetTLFConversationsLocalRpcPromise)
  const {
    teamMeta: {teamname},
  } = useLoadedTeam(teamID)
  const emptyChannelMetas = React.useMemo(() => new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>(), [])
  const [state, setState] = React.useState<ChannelMetasState>(() => ({
    channelMetas: emptyChannelMetas,
    loadedTeamID: teamID,
    loadingChannels: true,
  }))
  const requestVersionRef = React.useRef(0)
  const requestTeamIDRef = React.useRef(teamID)

  React.useEffect(() => {
    if (requestTeamIDRef.current !== teamID) {
      requestTeamIDRef.current = teamID
      requestVersionRef.current++
    }
  }, [teamID])

  const reloadChannels = React.useCallback(
    async () =>
      new Promise<void>((resolve, reject) => {
        if (!teamname) {
          setState({channelMetas: emptyChannelMetas, loadedTeamID: teamID, loadingChannels: true})
          resolve()
          return
        }
        const requestVersion = ++requestVersionRef.current
        setState(prev => ({...prev, loadingChannels: true}))
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
            if (requestVersion !== requestVersionRef.current) {
              resolve()
              return
            }
            setState({
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
              loadedTeamID: teamID,
              loadingChannels: false,
            })
            resolve()
          },
          error => {
            if (requestVersion !== requestVersionRef.current) {
              resolve()
              return
            }
            setState(prev => ({...prev, loadedTeamID: teamID, loadingChannels: false}))
            reject(error)
          }
        )
      }),
    [emptyChannelMetas, getConversations, teamID, teamname]
  )

  React.useEffect(() => {
    if (!dontCallRPC) {
      reloadChannels()
        .then(() => {})
        .catch(() => {})
    }
  }, [reloadChannels, dontCallRPC])

  const visibleState =
    state.loadedTeamID === teamID
      ? state
      : {channelMetas: emptyChannelMetas, loadedTeamID: teamID, loadingChannels: true}

  return {
    channelMetas: visibleState.channelMetas,
    loadingChannels: visibleState.loadingChannels,
    reloadChannels,
  }
}
