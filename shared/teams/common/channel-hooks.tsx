import * as React from 'react'
import * as Container from '../../util/container'
import type * as Types from '../../constants/types/teams'
import type * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import * as Constants from '../../constants/teams'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'

// Filter bots out using team role info, isolate to only when related state changes
export const useChannelParticipants = (
  teamID: Types.TeamID,
  conversationIDKey: ChatTypes.ConversationIDKey
) => {
  const participants = ChatConstants.useConvoState(conversationIDKey, s => s.participants.all)
  const teamMembers = Constants.useState(s => s.teamDetails.get(teamID)?.members)
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
  teamID: Types.TeamID,
  dontCallRPC?: boolean
): {
  channelMetas: Map<ChatTypes.ConversationIDKey, ChatTypes.ConversationMeta>
  loadingChannels: boolean
  reloadChannels: () => Promise<void>
} => {
  const getConversations = Container.useRPC(RPCChatTypes.localGetTLFConversationsLocalRpcPromise)

  const teamname = Constants.useState(s => Constants.getTeamNameFromID(s, teamID) ?? '')
  const [channelMetas, setChannelMetas] = React.useState(
    new Map<ChatTypes.ConversationIDKey, ChatTypes.ConversationMeta>()
  )

  const [loadingChannels, setLoadingChannels] = React.useState(true)

  const reloadChannels = React.useCallback(
    async () =>
      new Promise<void>((resolve, reject) => {
        setLoadingChannels(true)
        getConversations(
          [
            {
              membersType: RPCChatTypes.ConversationMembersType.team,
              tlfName: teamname,
              topicType: RPCChatTypes.TopicType.chat,
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
                    }, new Array<[string, ChatTypes.ConversationMeta]>())
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
  teamID: Types.TeamID,
  conversationIDKey: ChatTypes.ConversationIDKey
): ChatTypes.ConversationMeta | undefined => {
  const getInboxItem = Container.useRPC(RPCChatTypes.localGetInboxAndUnboxUILocalRpcPromise)
  const [conv, setConv] = React.useState<RPCChatTypes.InboxUIItem | undefined>()

  const waitingKey = Constants.teamWaitingKey(teamID)

  React.useEffect(() => {
    getInboxItem(
      [
        {
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
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
