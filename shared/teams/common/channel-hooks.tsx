import * as React from 'react'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import * as Constants from '../../constants/teams'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'

const emptyArrForUseSelector = []

function filterNull<A>(arr: Array<A | null>): Array<A> {
  return arr.filter(a => a !== null) as Array<A>
}

// Filter bots out using team role info, isolate to only when related state changes
export const useChannelParticipants = (
  teamID: Types.TeamID,
  conversationIDKey: ChatTypes.ConversationIDKey
) => {
  const participants = Container.useSelector(s => ChatConstants.getParticipantInfo(s, conversationIDKey).all)
  const teamMembers = Container.useSelector(s => Constants.getTeamDetails(s, teamID).members)
  return React.useMemo(
    () =>
      participants.filter(
        username => !['bot', 'restrictedBot'].includes(teamMembers.get(username)?.type ?? '')
      ),
    [participants, teamMembers]
  )
}

export const useAllChannelMetas = (
  teamID: Types.TeamID,
  dontCallRPC?: boolean
): {
  channelMetas: Map<ChatTypes.ConversationIDKey, ChatTypes.ConversationMeta>
  loadingChannels: boolean
  reloadChannels: () => Promise<undefined>
} => {
  const getConversations = Container.useRPC(RPCChatTypes.localGetTLFConversationsLocalRpcPromise)

  const teamname = Container.useSelector(state => Constants.getTeamNameFromID(state, teamID) ?? '')
  const [inboxUIItems, setConvs] = React.useState<RPCChatTypes.InboxUIItem[] | null>(null)
  const [loadingChannels, setLoadingChannels] = React.useState(true)

  const reloadChannels = React.useCallback(
    () =>
      new Promise<undefined>((resolve, reject) => {
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
            convs && setConvs(convs)
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
    }
  }, [reloadChannels, dontCallRPC])

  const conversationMetas = Container.useSelector(
    state =>
      inboxUIItems?.map(conv => ChatConstants.inboxUIItemToConversationMeta(state, conv)) ??
      emptyArrForUseSelector
  )
  // TODO: not always a new map?
  const channelMetas = new Map(filterNull(conversationMetas).map(a => [a.conversationIDKey, a]))
  return {channelMetas, loadingChannels, reloadChannels}
}

export const useChannelMeta = (
  teamID: Types.TeamID,
  conversationIDKey: ChatTypes.ConversationIDKey
): ChatTypes.ConversationMeta | null => {
  const getInboxItem = Container.useRPC(RPCChatTypes.localGetInboxAndUnboxUILocalRpcPromise)
  const [conv, setConv] = React.useState<RPCChatTypes.InboxUIItem | null>(null)

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

  const meta: ChatTypes.ConversationMeta | null = Container.useSelector(state =>
    conv ? ChatConstants.inboxUIItemToConversationMeta(state, conv) : null
  )

  return meta
}
