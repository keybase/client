// What a user can do to one chat message: delete it, react to it, reply privately, collapse it,
// remove an unfurl, pin it, dismiss a journeycard.
//
// A command runs one of two ways, chosen by the target it is given:
// - {ordinal, thread}: a row in a mounted thread (useThreadMessageTarget builds it). The message is
//   read from the thread store at call time, and the store is updated around the call (the
//   deleting state and its revert, the optimistic reaction, dropping a cancelled or dismissed row).
//   The service is asked through the thread's rpc, which, like the store's actions, does nothing
//   once the thread's account has left: its conversation id can name the next account's copy of a
//   shared team channel.
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
import {getChatRpc, type ChatThreadRpc} from './chat-rpc'
import {getClientPrevFromThread, getConversationClientPrev} from './client-prev'
import {getMeta} from './thread-load'
import {applyOptimisticReactionsToMessage} from './thread-message-state'
import {useConversationThreadActions, useConversationThreadID} from './thread-context'
import type {ConversationThreadActions} from './thread-store'

// The slice of a mounted thread the commands read and write.
export type MessageCommandThread = Pick<
  ConversationThreadActions,
  | 'addOptimisticReaction'
  | 'addPendingDelete'
  | 'deleteMessages'
  | 'getSnapshot'
  | 'removeOptimisticReaction'
  | 'removePendingDelete'
  | 'rpc'
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

// Runs a command's thread or storeless arm. A thread-only command passes never for Storeless.
const onTarget = <Storeless extends object>(
  target: ThreadMessage | Storeless,
  onThread: (target: ThreadMessage) => void,
  onStoreless: (target: Storeless) => void
) => {
  if (isThread(target)) {
    onThread(target)
  } else {
    onStoreless(target)
  }
}
const threadOnly = () => {}

export const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

// What both paths do: cancel an unsent message's outbox entry, or ask the service to delete a sent
// message. A thread passes its hooks: dropping the cancelled row, and undoing its deleting mark when
// nothing was deleted. tlfName falls back to the inbox meta's, then to none.
const deleteConversationMessage = async (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  message: T.Chat.Message
  onCancelled?: () => void
  onNotDeleted?: () => void
  // the delete's own
  outboxID: T.RPCChat.OutboxID
  rpc: ChatThreadRpc
  tlfName?: string
}) => {
  const {conversationIDKey, message, onCancelled, onNotDeleted, outboxID, rpc} = p
  const bail = (reason: string) => {
    logger.warn(`deleteMessage: ${reason}`)
    onNotDeleted?.()
  }
  if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
    bail('no conversation id')
    return
  }
  try {
    if (!message.id) {
      if (!message.outboxID) {
        bail('no message id or outbox id')
        return
      }
      await rpc.cancelPost(message.outboxID)
      onCancelled?.()
      return
    }
    // With no meta (a popup opened from search or the pinned banner) the service fills in the tlf name.
    const tlfName = p.tlfName || getInboxConversationMeta(conversationIDKey)?.tlfname || ''
    // a successful delete leaves a thread's row deleting; the service's delete notification removes it
    await rpc.postDelete({conversationIDKey, messageID: message.id, outboxID, tlfName})
  } catch (error) {
    onNotDeleted?.()
    if (error instanceof RPCError) {
      logger.warn(`deleteMessage: failed to delete: ${error.message}`)
    } else {
      throw error
    }
  }
}

// A message not yet sent is cancelled instead.
export const deleteMessage = (target: ThreadMessage | StorelessMessage) => {
  // The delete's own outbox id: a thread's key to its pending delete, and what a failedMessage for
  // the delete names once the service has queued it.
  const outboxID = Common.generateOutboxID()
  onTarget(
    target,
    ({conversationIDKey, ordinal, thread}) => {
      const message = thread.getSnapshot().messageMap.get(ordinal)
      if (!message) {
        logger.warn('deleteMessage: message not in the thread')
        return
      }
      const deleteOutboxID = T.Chat.rpcOutboxIDToOutboxID(outboxID)
      // Only a sent row shows deleting, whatever edit it has in flight. An unsent one keeps its
      // pending or failed state, which the renderers read (an unsent video does not play), until
      // the cancel removes it.
      if ((message.type === 'text' || message.type === 'attachment') && message.id) {
        thread.addPendingDelete(deleteOutboxID, ordinal)
      }
      ignorePromise(
        deleteConversationMessage({
          conversationIDKey,
          message,
          onCancelled: () => thread.deleteMessages({ordinals: [ordinal]}),
          // drops only this call's entry, so another delete of the row still pending keeps it deleting
          onNotDeleted: () => thread.removePendingDelete(deleteOutboxID),
          outboxID,
          rpc: thread.rpc,
        })
      )
    },
    storeless => ignorePromise(deleteConversationMessage({...storeless, outboxID, rpc: getChatRpc()}))
  )
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
  } else {
    logger.error('toggleReaction: failed to post', error)
  }
}

const toggleThreadReaction = (target: ThreadMessage, emoji: string) => {
  const {conversationIDKey, ordinal, thread} = target
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
      await thread.rpc.postReaction({
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
  onTarget(
    target,
    thread => toggleThreadReaction(thread, emoji),
    storeless => {
      const reactionTarget =
        'message' in storeless
          ? reactionTargetOf(storeless.message)
          : {exploded: false, messageID: storeless.messageID}
      toggleStorelessReaction(storeless.conversationIDKey, reactionTarget, storeless.tlfName, emoji)
    }
  )
}

// Opens a conversation between you and the author with the text message quoted in the composer.
// A non-text message still makes the conversation, but nothing is opened.
export const replyPrivately = (target: ThreadMessage | StorelessMessage) => {
  onTarget(
    target,
    ({ordinal, thread}) => {
      const message = thread.getSnapshot().messageMap.get(ordinal)
      if (!message) {
        logger.warn("replyPrivately: can't find message to reply to", ordinal)
        return
      }
      replyPrivatelyTo(message, thread.rpc)
    },
    storeless => replyPrivatelyTo(storeless.message, getChatRpc())
  )
}

const replyPrivatelyTo = (message: T.Chat.Message, rpc: ChatThreadRpc) => {
  const f = async () => {
    const username = useCurrentUserState.getState().username
    if (!username) {
      throw new Error('replyPrivately: making a convo while logged out?')
    }
    const result = await rpc.createAdhocConversation(
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
  onTarget<never>(target, row => toggleThreadCollapse(row, messageID), threadOnly)
}

const toggleThreadCollapse = ({conversationIDKey, ordinal, thread}: ThreadMessage, messageID: T.Chat.MessageID) => {
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
      await thread.rpc.toggleCollapse({collapse: !isCollapsed, conversationIDKey, messageID})
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

// messageID is the unfurl's own message.
export const removeUnfurl = (target: ThreadMessage, messageID: T.Chat.MessageID) => {
  onTarget<never>(
    target,
    ({conversationIDKey, thread}) => removeConversationUnfurl(conversationIDKey, messageID, thread.rpc),
    threadOnly
  )
}

const removeConversationUnfurl = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID,
  rpc: ChatThreadRpc
) => {
  const f = async () => {
    const meta = getInboxConversationMeta(conversationIDKey)
    if (!meta) {
      logger.debug('unfurl remove no meta found, aborting!')
      return
    }
    try {
      await rpc.postDelete({conversationIDKey, messageID, tlfName: meta.tlfname})
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

// A thread row is pinned by the id it holds when this runs.
export const pinMessage = (target: ThreadMessage | StorelessMessageID) => {
  onTarget(
    target,
    ({conversationIDKey, ordinal, thread}) => {
      const messageID = thread.getSnapshot().messageMap.get(ordinal)?.id
      if (!messageID) {
        logger.warn('pinMessage: message has no id in the thread')
        return
      }
      pinConversationMessage(conversationIDKey, messageID, thread.rpc)
    },
    ({conversationIDKey, messageID}) => pinConversationMessage(conversationIDKey, messageID, getChatRpc())
  )
}

const pinConversationMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID,
  rpc: ChatThreadRpc
) => {
  const f = async () => {
    try {
      await rpc.pinMessage(conversationIDKey, messageID)
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
  onTarget(
    target,
    ({conversationIDKey, ordinal, thread}) =>
      ignorePromise(
        dismissConversationJourneycard(conversationIDKey, cardType, thread.rpc, () =>
          thread.deleteMessages({ordinals: [ordinal]})
        )
      ),
    ({conversationIDKey}) =>
      ignorePromise(dismissConversationJourneycard(conversationIDKey, cardType, getChatRpc()))
  )
}

const dismissConversationJourneycard = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  cardType: T.RPCChat.JourneycardType,
  rpc: ChatThreadRpc,
  onAnswered?: () => void
) => {
  await rpc
    .dismissJourneycard(conversationIDKey, cardType)
    .catch((error: unknown) => {
      if (error instanceof RPCError) {
        logger.error(`Failed to dismiss journeycard: ${error.message}`)
      }
    })
  onAnswered?.()
}

