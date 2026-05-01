import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'

type WaitingKey = string | ReadonlyArray<string>

export const cancelConversationPost = (outboxID: T.Chat.OutboxID) =>
  T.RPCChat.localCancelPostRpcPromise({
    outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID),
  })

export const postConversationDelete = (p: {
  clientPrev?: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
  tlfName: string
}) =>
  T.RPCChat.localPostDeleteNonblockRpcPromise({
    clientPrev: p.clientPrev ?? T.Chat.numberToMessageID(0),
    conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    outboxID: null,
    supersedes: p.messageID,
    tlfName: p.tlfName,
    tlfPublic: false,
  })

export const postConversationReaction = (p: {
  body: string
  clientPrev: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
  outboxID?: T.RPCChat.OutboxID
  tlfName: string
}) =>
  T.RPCChat.localPostReactionNonblockRpcPromise({
    body: p.body,
    clientPrev: p.clientPrev,
    conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    outboxID: p.outboxID ?? Common.generateOutboxID(),
    supersedes: p.messageID,
    tlfName: p.tlfName,
    tlfPublic: false,
  })

export const createAdhocConversation = (usernames: ReadonlyArray<string>, waitingKey?: WaitingKey) =>
  T.RPCChat.localNewConversationLocalRpcPromise(
    {
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      membersType: T.RPCChat.ConversationMembersType.impteamnative,
      tlfName: [...new Set(usernames)].join(','),
      tlfVisibility: T.RPCGen.TLFVisibility.private,
      topicType: T.RPCChat.TopicType.chat,
    },
    waitingKey
  )

export const dismissConversationJourneycardRPC = (
  conversationIDKey: T.Chat.ConversationIDKey,
  cardType: T.RPCChat.JourneycardType
) =>
  T.RPCChat.localDismissJourneycardRpcPromise({
    cardType,
    convID: T.Chat.keyToConversationID(conversationIDKey),
  })
