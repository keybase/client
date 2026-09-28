// What a user can do to one chat message: delete it, react to it, reply privately, collapse it,
// remove an unfurl, pin it, dismiss a journeycard.
//
// A command runs one of two ways, chosen by the target it is given:
// - {ordinal, thread}: a row in a mounted thread (useThreadMessageTarget builds it). The message is read from the thread store at call
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
import {getClientPrevFromThread, getConversationClientPrev} from './client-prev'
import {getMeta} from './thread-load'
import {applyOptimisticReactionsToMessage} from './thread-message-state'
import {useConversationThreadActions, useConversationThreadID} from './thread-context'
import type {ConversationThreadActions} from './thread-store'

// The slice of a mounted thread the commands read and write.
export type MessageCommandThread = Pick<
  ConversationThreadActions,
  'addOptimisticReaction' | 'deleteMessages' | 'getSnapshot' | 'removeOptimisticReaction' | 'setMessageSubmitState'
>

// Every target names its conversation.
export type ThreadMessage = {
  conversationIDKey: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
  thread: MessageCommandThread
}
// tlfName falls back to the inbox meta's
export type StorelessMessage = {
  conversationIDKey: T.Chat.ConversationIDKey
  message: T.Chat.Message
  tlfName?: string
}
export type StorelessMessageID = {
  conversationIDKey: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
  tlfName?: string
}

// The row at ordinal in the thread this component is rendered inside.
export const useThreadMessageTarget = (ordinal: T.Chat.Ordinal): ThreadMessage => {
  const conversationIDKey = useConversationThreadID()
  const thread = useConversationThreadActions()
  return {conversationIDKey, ordinal, thread}
}

const isThread = (target: object): target is ThreadMessage => 'thread' in target

export const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

const deleteThreadMessage = (conversationIDKey: T.Chat.ConversationIDKey, target: ThreadMessage) => {
  const {ordinal, thread} = target
  const deletable = () => {
    const m = thread.getSnapshot().messageMap.get(ordinal)
    return m?.type === 'text' || m?.type === 'attachment' ? m : undefined
  }
  if (deletable()) {
    thread.setMessageSubmitState(ordinal, 'deleting')
  }
  // only undoes our own mark: a row that moved on since keeps its new state
  const revertDeleting = () => {
    if (deletable()?.submitState === 'deleting') {
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
    const meta = getInboxConversationMeta(conversationIDKey)
    if (!meta) {
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
      await getChatRpc().postDelete({conversationIDKey, messageID: message.id, tlfName: meta.tlfname})
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
    try {
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
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn(`deleteConversationMessage: failed to delete: ${error.message}`)
      } else {
        throw error
      }
    }
  }
  ignorePromise(f())
}

// A message not yet sent is cancelled instead.
export const deleteMessage = (target: ThreadMessage | StorelessMessage) => {
  if (isThread(target)) {
    deleteThreadMessage(target.conversationIDKey, target)
  } else {
    deleteStorelessMessage(target.conversationIDKey, target)
  }
}

type ReactionTarget = {exploded: boolean; messageID: T.Chat.MessageID}

const reactionTargetOf = (message: T.Chat.Message): ReactionTarget => ({
  exploded: (message.type === 'text' || message.type === 'attachment') && message.exploded,
  messageID: message.id,
})

// The user reacting, or undefined (logged) when this reaction cannot be sent.
const reactingUser = (
  conversationIDKey: T.Chat.ConversationIDKey,
  target: ReactionTarget | undefined,
  emoji: string
) => {
  if (!emoji) {
    return undefined
  }
  if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
    logger.warn('toggleReaction: no conversation id')
    return undefined
  }
  if (!target) {
    logger.warn('toggleReaction: no message found')
    return undefined
  }
  if (target.exploded) {
    logger.warn('toggleReaction: message is exploded')
    return undefined
  }
  if (!T.Chat.messageIDToNumber(target.messageID)) {
    logger.warn('toggleReaction: message has no id yet')
    return undefined
  }
  const {username} = useCurrentUserState.getState()
  if (!username) {
    logger.warn('toggleReaction: no current username')
    return undefined
  }
  return username
}

const logReactionFailure = (error: unknown) => {
  if (error instanceof RPCError) {
    logger.info(`toggleReaction: failed to post ${error.message}`)
  }
}

const toggleThreadReaction = (
  conversationIDKey: T.Chat.ConversationIDKey,
  target: ThreadMessage,
  emoji: string
) => {
  const {ordinal, thread} = target
  const f = async () => {
    const snapshot = thread.getSnapshot()
    const message = snapshot.messageMap.get(ordinal)
    const username = reactingUser(conversationIDKey, message && reactionTargetOf(message), emoji)
    if (!message || !username) {
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
        clientPrev: getClientPrevFromThread(snapshot.messageMap, snapshot.messageOrdinals),
        conversationIDKey,
        emoji,
        messageID: message.id,
        outboxID,
        tlfName: getMeta(conversationIDKey).tlfname,
      })
    } catch (error) {
      thread.removeOptimisticReaction(localOutboxID)
      logReactionFailure(error)
    }
  }
  ignorePromise(f())
}

const toggleStorelessReaction = (
  conversationIDKey: T.Chat.ConversationIDKey,
  target: ReactionTarget,
  tlfName: string | undefined,
  emoji: string
) => {
  const f = async () => {
    if (!reactingUser(conversationIDKey, target, emoji)) {
      return
    }
    try {
      await getChatRpc().postReaction({
        clientPrev: getConversationClientPrev(conversationIDKey),
        conversationIDKey,
        emoji,
        messageID: target.messageID,
        tlfName: tlfName || getInboxConversationMeta(conversationIDKey)?.tlfname || '',
      })
    } catch (error) {
      logReactionFailure(error)
    }
  }
  ignorePromise(f())
}

// Adds the emoji, or removes it if it is yours already. Only a thread knows the message's reactions
// and shows the change before the service confirms it; outside one the service decides.
export const toggleReaction = (target: ThreadMessage | StorelessMessage | StorelessMessageID, emoji: string) => {
  const {conversationIDKey} = target
  if (isThread(target)) {
    toggleThreadReaction(conversationIDKey, target, emoji)
    return
  }
  const reactionTarget =
    'message' in target ? reactionTargetOf(target.message) : {exploded: false, messageID: target.messageID}
  toggleStorelessReaction(conversationIDKey, reactionTarget, target.tlfName, emoji)
}

// Opens a conversation between you and the author with the text message quoted in the composer.
// A non-text message still makes the conversation, but nothing is opened.
export const replyPrivately = (target: ThreadMessage | StorelessMessage) => {
  const f = async () => {
    let message: T.Chat.Message | undefined
    if (isThread(target)) {
      message = target.thread.getSnapshot().messageMap.get(target.ordinal)
      if (!message) {
        logger.warn("replyPrivately: can't find message to reply to", target.ordinal)
        return
      }
    } else {
      message = target.message
    }
    const username = useCurrentUserState.getState().username
    if (!username) {
      throw new Error('replyPrivately: making a convo while logged out?')
    }
    const result = await getChatRpc().createAdhocConversation(
      [username, message.author],
      Strings.waitingKeyChatCreating
    )
    const newThreadCID = T.Chat.conversationIDToKey(result.conv.info.id)
    if (!newThreadCID) {
      logger.warn("replyPrivately: couldn't make a new conversation")
      return
    }
    const meta = Meta.inboxUIItemToConversationMeta(result.uiConv)
    if (!meta) {
      logger.warn('replyPrivately: unable to make meta')
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
export const toggleCollapse = (target: ThreadMessage, messageID: T.Chat.MessageID) => {
  const {conversationIDKey, ordinal, thread} = target
  const f = async () => {
    const m = thread.getSnapshot().messageMap.get(ordinal)
    let isCollapsed = false

    if (m?.id === messageID) {
      isCollapsed = m.isCollapsed ?? false
    } else {
      const unfurlInfos = [...(m?.unfurls?.values() ?? [])]
      const ui = unfurlInfos.find(u => u.unfurlMessageID === messageID)
      if (ui) {
        isCollapsed = ui.isCollapsed
      }
    }
    try {
      await getChatRpc().toggleCollapse({collapse: !isCollapsed, conversationIDKey, messageID})
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn(`toggleCollapse: failed to toggle collapse: ${error.message}`)
      } else {
        throw error
      }
    }
  }
  ignorePromise(f())
}

export const removeUnfurl = (conversationIDKey: T.Chat.ConversationIDKey, messageID: T.Chat.MessageID) => {
  const f = async () => {
    const meta = getInboxConversationMeta(conversationIDKey)
    if (!meta) {
      logger.debug('unfurl remove no meta found, aborting!')
      return
    }
    try {
      await getChatRpc().postDelete({conversationIDKey, messageID, tlfName: meta.tlfname})
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn(`removeUnfurl: failed to remove unfurl: ${error.message}`)
      } else {
        throw error
      }
    }
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
  target: ThreadMessage | {conversationIDKey: T.Chat.ConversationIDKey},
  cardType: T.RPCChat.JourneycardType
) => {
  const {conversationIDKey} = target
  const f = async () => {
    await getChatRpc().dismissJourneycard(conversationIDKey, cardType).catch((error: unknown) => {
      if (error instanceof RPCError) {
        logger.error(`Failed to dismiss journeycard: ${error.message}`)
      }
    })
    if (isThread(target)) {
      target.thread.deleteMessages({ordinals: [target.ordinal]})
    }
  }
  ignorePromise(f())
}
