import * as Meta from '@/constants/chat/meta'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {getInboxConversationMeta, metasReceived} from '@/chat/inbox/metadata'
import {navigateToThread} from '@/constants/router'
import {useCurrentUserState} from '@/stores/current-user'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {
  cancelConversationPost,
  createAdhocConversation,
  dismissConversationJourneycardRPC,
  postConversationDelete,
  postConversationReaction,
} from '@/chat/conversation/message-rpc'

const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

const getClientPrev = (conversationIDKey: T.Chat.ConversationIDKey) =>
  getInboxConversationMeta(conversationIDKey)?.maxVisibleMsgID ?? T.Chat.numberToMessageID(0)

export const deleteConversationMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.Message,
  tlfName?: string
) => {
  const f = async () => {
    if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
      logger.warn('deleteConversationMessage: no conversation id')
      return
    }
    if (!message.id) {
      if (message.outboxID) {
        await cancelConversationPost(message.outboxID)
      } else {
        logger.warn('deleteConversationMessage: no message id or outbox id')
      }
      return
    }
    await postConversationDelete({
      conversationIDKey,
      messageID: message.id,
      tlfName: tlfName || getInboxConversationMeta(conversationIDKey)?.tlfname || '',
    })
  }
  ignorePromise(f())
}

export const toggleConversationMessageReaction = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.Message,
  emoji: string,
  tlfName?: string
) => {
  const {type, exploded, id: messageID} = message
  if ((type === 'text' || type === 'attachment') && exploded) {
    logger.warn('toggleConversationMessageReaction: message is exploded')
    return
  }
  toggleConversationMessageReactionByID(conversationIDKey, messageID, emoji, tlfName)
}

export const toggleConversationMessageReactionByID = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID,
  emoji: string,
  tlfName?: string
) => {
  const f = async () => {
    if (!emoji) {
      return
    }
    if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
      logger.warn('toggleConversationMessageReaction: no conversation id')
      return
    }
    if (!T.Chat.messageIDToNumber(messageID)) {
      logger.warn('toggleConversationMessageReaction: no message id')
      return
    }
    const username = useCurrentUserState.getState().username
    if (!username) {
      logger.warn('toggleConversationMessageReaction: no current username')
      return
    }
    try {
      await postConversationReaction({
        body: emoji,
        clientPrev: getClientPrev(conversationIDKey),
        conversationIDKey,
        messageID,
        tlfName: tlfName || getInboxConversationMeta(conversationIDKey)?.tlfname || '',
      })
    } catch (error) {
      if (error instanceof RPCError) {
        logger.info(`toggleConversationMessageReaction: failed to post ${error.message}`)
      }
    }
  }
  ignorePromise(f())
}

export const replyPrivatelyToConversationMessage = (message: T.Chat.Message) => {
  const f = async () => {
    const username = useCurrentUserState.getState().username
    if (!username) {
      throw new Error('replyPrivatelyToConversationMessage: making a convo while logged out?')
    }
    const result = await createAdhocConversation([username, message.author], Strings.waitingKeyChatCreating)
    const newThreadCID = T.Chat.conversationIDToKey(result.conv.info.id)
    if (!newThreadCID) {
      logger.warn("replyPrivatelyToConversationMessage: couldn't make a new conversation")
      return
    }
    const meta = Meta.inboxUIItemToConversationMeta(result.uiConv)
    if (!meta) {
      logger.warn('replyPrivatelyToConversationMessage: unable to make meta')
      return
    }
    if (message.type !== 'text') {
      return
    }

    const text = formatTextForQuoting(message.text.stringValue())
    metasReceived([meta])
    navigateToThread(newThreadCID, 'createdMessagePrivately', undefined, undefined, undefined, text)
  }
  ignorePromise(f())
}

export const pinConversationMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID
) => {
  const f = async () => {
    try {
      await T.RPCChat.localPinMessageRpcPromise({
        convID: T.Chat.keyToConversationID(conversationIDKey),
        msgID: messageID,
      })
    } catch (error) {
      if (error instanceof RPCError) {
        logger.error(`pinConversationMessage: ${error.message}`)
      }
    }
  }
  ignorePromise(f())
}

export const dismissConversationJourneycard = (
  conversationIDKey: T.Chat.ConversationIDKey,
  cardType: T.RPCChat.JourneycardType
) => {
  const f = async () => {
    await dismissConversationJourneycardRPC(conversationIDKey, cardType).catch((error: unknown) => {
      if (error instanceof RPCError) {
        logger.error(`Failed to dismiss journeycard: ${error.message}`)
      }
    })
  }
  ignorePromise(f())
}
