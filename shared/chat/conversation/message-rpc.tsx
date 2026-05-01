import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'

type WaitingKey = string | ReadonlyArray<string>

export const cancelConversationPost = async (outboxID: T.Chat.OutboxID) => {
  return await T.RPCChat.localCancelPostRpcPromise({
    outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID),
  })
}

export const postConversationDelete = async (p: {
  clientPrev?: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
  tlfName: string
}) => {
  return await T.RPCChat.localPostDeleteNonblockRpcPromise({
    clientPrev: p.clientPrev ?? T.Chat.numberToMessageID(0),
    conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    outboxID: null,
    supersedes: p.messageID,
    tlfName: p.tlfName,
    tlfPublic: false,
  })
}

export const postConversationReaction = async (p: {
  body: string
  clientPrev: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
  outboxID?: T.RPCChat.OutboxID
  tlfName: string
}) => {
  return await T.RPCChat.localPostReactionNonblockRpcPromise({
    body: p.body,
    clientPrev: p.clientPrev,
    conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    outboxID: p.outboxID ?? Common.generateOutboxID(),
    supersedes: p.messageID,
    tlfName: p.tlfName,
    tlfPublic: false,
  })
}

export const createAdhocConversation = async (
  usernames: ReadonlyArray<string>,
  waitingKey?: WaitingKey
) => {
  return await T.RPCChat.localNewConversationLocalRpcPromise(
    {
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      membersType: T.RPCChat.ConversationMembersType.impteamnative,
      tlfName: [...new Set(usernames)].join(','),
      tlfVisibility: T.RPCGen.TLFVisibility.private,
      topicType: T.RPCChat.TopicType.chat,
    },
    waitingKey
  )
}

export const dismissConversationJourneycardRPC = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  cardType: T.RPCChat.JourneycardType
) => {
  return await T.RPCChat.localDismissJourneycardRpcPromise({
    cardType,
    convID: T.Chat.keyToConversationID(conversationIDKey),
  })
}
