import * as T from '../../constants/types'
import * as C from '../../constants'
import * as React from 'react'
import * as Container from '../../util/container'
import * as ChatConstants from '../../constants/chat2'
import * as Constants from '../../constants/teams'

// Filter bots out using team role info, isolate to only when related state changes
export const useChannelParticipants = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey
) => {
  const participants = C.useConvoState(conversationIDKey, s => s.participants.all)
  const teamMembers = C.useTeamsState(s => s.teamDetails.get(teamID)?.members)
  return React.useMemo(
    () =>
      participants.filter(username => {
        const maybeMember = teamMembers?.get(username)
        return maybeMember && maybeMember.type !== 'bot' && maybeMember.type !== 'restrictedbot'
      }),
    [participants, teamMembers]
  )
}

export const useAllChannelMetas = (
  teamID: T.Teams.TeamID,
  dontCallRPC?: boolean
): {
  channelMetas: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  loadingChannels: boolean
  reloadChannels: () => Promise<void>
} => {
  const getConversations = Container.useRPC(T.RPCChat.localGetTLFConversationsLocalRpcPromise)

  const teamname = C.useTeamsState(s => Constants.getTeamNameFromID(s, teamID) ?? '')
  const [channelMetas, setChannelMetas] = React.useState(
    new Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>()
  )

  const [loadingChannels, setLoadingChannels] = React.useState(true)

  const reloadChannels = React.useCallback(
    async () =>
      new Promise<void>((resolve, reject) => {
        setLoadingChannels(true)
        getConversations(
          [
            {
              membersType: T.RPCChat.ConversationMembersType.team,
              tlfName: teamname,
              topicType: T.RPCChat.TopicType.chat,
            },
            Constants.getChannelsWaitingKey(teamID),
          ],
          ({convs}) => {
            resolve()
            if (convs) {
              setChannelMetas(
                new Map(
                  convs
                    ?.map(conv => ChatConstants.inboxUIItemToConversationMeta(conv))
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
      }),
    [setLoadingChannels, teamID, teamname, getConversations]
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

export const useChannelMeta = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey
): T.Chat.ConversationMeta | undefined => {
  const getInboxItem = Container.useRPC(T.RPCChat.localGetInboxAndUnboxUILocalRpcPromise)
  const [conv, setConv] = React.useState<T.RPCChat.InboxUIItem | undefined>()

  const waitingKey = Constants.teamWaitingKey(teamID)

  React.useEffect(() => {
    getInboxItem(
      [
        {
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          query: ChatConstants.makeInboxQuery([conversationIDKey], true /* all statuses */),
        },
        waitingKey,
      ],
      ({conversations}) => {
        if (conversations?.length === 1) {
          setConv(conversations[0])
        }
      },
      () => {} // TODO: error handling
    )
  }, [teamID, conversationIDKey, getInboxItem, waitingKey])

  const meta = conv ? ChatConstants.inboxUIItemToConversationMeta(conv) : undefined
  return meta ?? undefined
}
