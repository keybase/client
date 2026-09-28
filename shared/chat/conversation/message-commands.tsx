// What a user can do to one chat message: delete it, react to it, reply privately, collapse it,
// remove an unfurl, pin it, dismiss a journeycard.
//
// A command runs one of two ways, chosen by the target it is given:
// - {ordinal, thread}: a row in a mounted thread. The message is read from the thread store at call
//   time, and the store is updated around the call (the deleting state and its revert, the
//   optimistic reaction, dropping a cancelled or dismissed row).
// - {message} or {messageID}: a message held outside any thread (a popup opened from search, the
//   emoji picker). Only the service is told; there is no store to update.
import * as Common from '@/constants/chat/common'
import * as Meta from '@/constants/chat/meta'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {getInboxConversationMeta, metasReceived} from '@/chat/inbox/metadata'
import {navigateToThread} from '@/constants/router'
import {useCurrentUserState} from '@/stores/current-user'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {getChatRpc} from './chat-rpc'
import {getClientPrevFromSnapshot, getConversationClientPrev} from './client-prev'
import {getMeta} from './thread-load'
import {applyOptimisticReactionsToMessage} from './thread-message-state'
import type {ConversationThreadActions} from './thread-context'

// The slice of a mounted thread the commands read and write.
export type MessageCommandThread = Pick<
  ConversationThreadActions,
  'addOptimisticReaction' | 'deleteMessages' | 'getSnapshot' | 'removeOptimisticReaction' | 'setMessageSubmitState'
>

export type ThreadMessage = {ordinal: T.Chat.Ordinal; thread: MessageCommandThread}
// tlfName falls back to the inbox meta's
export type StorelessMessage = {message: T.Chat.Message; tlfName?: string}
export type StorelessMessageID = {messageID: T.Chat.MessageID; tlfName?: string}

const isThread = (target: object): target is ThreadMessage => 'thread' in target

export const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

const deleteThreadMessage = (conversationIDKey: T.Chat.ConversationIDKey, target: ThreadMessage) => {
  const {ordinal, thread} = target
  const deletingText = () => {
    const m = thread.getSnapshot().messageMap.get(ordinal)
    return m?.type === 'text' ? m : undefined
  }
  if (deletingText()) {
    thread.setMessageSubmitState(ordinal, 'deleting')
  }
  // only undoes our own mark: a row that moved on since keeps its new state
  const revertDeleting = () => {
    if (deletingText()?.submitState === 'deleting') {
      thread.setMessageSubmitState(ordinal, undefined)
    }
  }

  const f = async () => {
    const message = thread.getSnapshot().messageMap.get(ordinal)
    if (!message) {
      logger.warn('Deleting invalid message')
      revertDeleting()
      return
    }
    if (!getInboxConversationMeta(conversationIDKey)) {
      logger.warn('Deleting message w/ no meta')
      revertDeleting()
      return
    }
    try {
      if (!message.id) {
        if (message.outboxID) {
          await getChatRpc().cancelPost(message.outboxID)
          thread.deleteMessages({ordinals: [message.ordinal]})
        } else {
          logger.warn('Delete of no message id and no outboxid')
          revertDeleting()
        }
        return
      }
      // a successful delete leaves the row deleting; the service's delete notification removes it
      await getChatRpc().postDelete({
        conversationIDKey,
        messageID: message.id,
        tlfName: getMeta(conversationIDKey).tlfname,
      })
    } catch (error) {
      revertDeleting()
      if (error instanceof RPCError) {
        logger.warn(`messageDelete: failed to delete: ${error.message}`)
      } else {
        throw error
      }
    }
  }
  ignorePromise(f())
}

const deleteStorelessMessage = (conversationIDKey: T.Chat.ConversationIDKey, target: StorelessMessage) => {
  const {message, tlfName} = target
  const f = async () => {
    if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
      logger.warn('deleteConversationMessage: no conversation id')
      return
    }
    if (!message.id) {
      if (message.outboxID) {
        await getChatRpc().cancelPost(message.outboxID)
      } else {
        logger.warn('deleteConversationMessage: no message id or outbox id')
      }
      return
    }
    await getChatRpc().postDelete({
      conversationIDKey,
      messageID: message.id,
      tlfName: tlfName || getInboxConversationMeta(conversationIDKey)?.tlfname || '',
    })
  }
  ignorePromise(f())
}

// A message not yet sent is cancelled instead.
export const deleteMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  target: ThreadMessage | StorelessMessage
) => {
  if (isThread(target)) {
    deleteThreadMessage(conversationIDKey, target)
  } else {
    deleteStorelessMessage(conversationIDKey, target)
  }
}

const toggleThreadReaction = (
  conversationIDKey: T.Chat.ConversationIDKey,
  target: ThreadMessage,
  emoji: string
) => {
  const {ordinal, thread} = target
  const f = async () => {
    if (!emoji) {
      return
    }
    const snapshot = thread.getSnapshot()
    const message = snapshot.messageMap.get(ordinal)
    if (!message) {
      logger.warn(`toggleMessageReaction: no message found`)
      return
    }
    const {type, exploded, id: messageID} = message
    if ((type === 'text' || type === 'attachment') && exploded) {
      logger.warn(`toggleMessageReaction: message is exploded`)
      return
    }
    if (!messageID) {
      logger.warn(`toggleMessageReaction: message has no id yet`)
      return
    }
    const username = useCurrentUserState.getState().username
    if (!username) {
      logger.warn(`toggleMessageReaction: no current username`)
      return
    }
    const displayMessage = applyOptimisticReactionsToMessage(message, snapshot.optimisticReactionMap)
    const add = !displayMessage?.reactions?.get(emoji)?.users.some(reaction => reaction.username === username)
    const outboxID = Common.generateOutboxID()
    const localOutboxID = T.Chat.rpcOutboxIDToOutboxID(outboxID)
    thread.addOptimisticReaction(localOutboxID, {
      add,
      decorated: emoji,
      emoji,
      targetOrdinal: ordinal,
      timestamp: Date.now(),
      username,
    })
    try {
      await getChatRpc().postReaction({
        clientPrev: getClientPrevFromSnapshot(snapshot),
        conversationIDKey,
        emoji,
        messageID,
        outboxID,
        tlfName: getMeta(conversationIDKey).tlfname,
      })
    } catch (error) {
      thread.removeOptimisticReaction(localOutboxID)
      if (error instanceof RPCError) {
        logger.info(`toggleMessageReaction: failed to post` + error.message)
      }
    }
  }
  ignorePromise(f())
}

const toggleStorelessReaction = (
  conversationIDKey: T.Chat.ConversationIDKey,
  target: StorelessMessageID,
  emoji: string
) => {
  const {messageID, tlfName} = target
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
      await getChatRpc().postReaction({
        clientPrev: getConversationClientPrev(conversationIDKey),
        conversationIDKey,
        emoji,
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

// Adds the emoji, or removes it if it is yours already. Only a thread knows the message's reactions
// and shows the change before the service confirms it; outside one the service decides.
export const toggleReaction = (
  conversationIDKey: T.Chat.ConversationIDKey,
  target: ThreadMessage | StorelessMessage | StorelessMessageID,
  emoji: string
) => {
  if (isThread(target)) {
    toggleThreadReaction(conversationIDKey, target, emoji)
    return
  }
  if ('message' in target) {
    const {type, exploded, id: messageID} = target.message
    if ((type === 'text' || type === 'attachment') && exploded) {
      logger.warn('toggleConversationMessageReaction: message is exploded')
      return
    }
    toggleStorelessReaction(conversationIDKey, {messageID, tlfName: target.tlfName}, emoji)
    return
  }
  toggleStorelessReaction(conversationIDKey, target, emoji)
}

const threadReplyLog = {
  noConversation: "messageReplyPrivately: couldn't make a new conversation?",
  noMeta: 'messageReplyPrivately: unable to make meta',
  signedOut: 'messageReplyPrivately: making a convo while logged out?',
}
const storelessReplyLog = {
  noConversation: "replyPrivatelyToConversationMessage: couldn't make a new conversation",
  noMeta: 'replyPrivatelyToConversationMessage: unable to make meta',
  signedOut: 'replyPrivatelyToConversationMessage: making a convo while logged out?',
}

// Opens a conversation between you and the author with the text message quoted in the composer.
// A non-text message still makes the conversation, but nothing is opened.
export const replyPrivately = (target: ThreadMessage | StorelessMessage) => {
  const log = isThread(target) ? threadReplyLog : storelessReplyLog
  const f = async () => {
    let message: T.Chat.Message | undefined
    if (isThread(target)) {
      message = target.thread.getSnapshot().messageMap.get(target.ordinal)
      if (!message) {
        logger.warn("messageReplyPrivately: can't find message to reply to", target.ordinal)
        return
      }
    } else {
      message = target.message
    }
    const username = useCurrentUserState.getState().username
    if (!username) {
      throw new Error(log.signedOut)
    }
    const result = await getChatRpc().createAdhocConversation(
      [username, message.author],
      Strings.waitingKeyChatCreating
    )
    const newThreadCID = T.Chat.conversationIDToKey(result.conv.info.id)
    if (!newThreadCID) {
      logger.warn(log.noConversation)
      return
    }
    const meta = Meta.inboxUIItemToConversationMeta(result.uiConv)
    if (!meta) {
      logger.warn(log.noMeta)
      return
    }
    if (message.type !== 'text') {
      return
    }

    const text = formatTextForQuoting(message.text.stringValue())
    metasReceived([meta])
    navigateToThread(newThreadCID, 'createdMessagePrivately', {intent: {text, type: 'injectText'}})
  }
  ignorePromise(f())
}

// messageID is the message itself or one of its unfurls; each has its own collapsed state.
export const toggleCollapse = (
  conversationIDKey: T.Chat.ConversationIDKey,
  target: ThreadMessage,
  messageID: T.Chat.MessageID
) => {
  const {ordinal, thread} = target
  const f = async () => {
    const m = thread.getSnapshot().messageMap.get(ordinal)
    let isCollapsed = false

    if (T.Chat.messageIDToNumber(messageID) !== T.Chat.ordinalToNumber(ordinal)) {
      const unfurlInfos = [...(m?.unfurls?.values() ?? [])]
      const ui = unfurlInfos.find(u => u.unfurlMessageID === messageID)
      if (ui) {
        isCollapsed = ui.isCollapsed
      }
    } else {
      isCollapsed = m?.isCollapsed ?? false
    }
    await getChatRpc().toggleCollapse({collapse: !isCollapsed, conversationIDKey, messageID})
  }
  ignorePromise(f())
}

export const removeUnfurl = (conversationIDKey: T.Chat.ConversationIDKey, messageID: T.Chat.MessageID) => {
  const f = async () => {
    if (!getInboxConversationMeta(conversationIDKey)) {
      logger.debug('unfurl remove no meta found, aborting!')
      return
    }
    await getChatRpc().postDelete({
      conversationIDKey,
      messageID,
      tlfName: getMeta(conversationIDKey).tlfname,
    })
  }
  ignorePromise(f())
}

export const pinMessage = (conversationIDKey: T.Chat.ConversationIDKey, messageID: T.Chat.MessageID) => {
  const f = async () => {
    try {
      await getChatRpc().pinMessage(conversationIDKey, messageID)
    } catch (error) {
      if (error instanceof RPCError) {
        logger.error(`pinConversationMessage: ${error.message}`)
      }
    }
  }
  ignorePromise(f())
}

// A thread drops the card's row once the service answers, whether or not it agreed.
export const dismissJourneycard = (
  conversationIDKey: T.Chat.ConversationIDKey,
  cardType: T.RPCChat.JourneycardType,
  row?: ThreadMessage
) => {
  const f = async () => {
    await getChatRpc().dismissJourneycard(conversationIDKey, cardType).catch((error: unknown) => {
      if (error instanceof RPCError) {
        logger.error(`Failed to dismiss journeycard: ${error.message}`)
      }
    })
    row?.thread.deleteMessages({ordinals: [row.ordinal]})
  }
  ignorePromise(f())
}
