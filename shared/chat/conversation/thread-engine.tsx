import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useEngineActionListener} from '@/engine/action-listener'
import {useThreadNotifications, type ThreadNotification} from '@/chat/notification-registry'
import {
  getCurrentUser,
  getExplodingModeFromGregorItems,
  getLastOrdinalFromSnapshot,
  getOrdinalForMessageIDInSnapshot,
} from './thread-load'
import type {ConversationThreadActions} from './thread-store'

export const applyMessagesUpdatedToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messagesUpdated: T.RPCChat.MessagesUpdated,
  actions: ConversationThreadActions
) => {
  if (!messagesUpdated.updates) return
  const snapshot = actions.getSnapshot()
  const activelyLookingAtThread = Common.isUserActivelyLookingAtThisThread(conversationIDKey)
  if (!snapshot.loaded && !activelyLookingAtThread) {
    return
  }

  const {username, devicename} = getCurrentUser()
  const messages = messagesUpdated.updates.flatMap(uimsg => {
    if (!Message.getMessageID(uimsg)) return []
    const message = Message.uiMessageToMessage(
      conversationIDKey,
      uimsg,
      username,
      () => getLastOrdinalFromSnapshot(actions.getSnapshot()),
      devicename
    )
    return message ? [message] : []
  })
  if (messages.length === 0) {
    return
  }
  actions.addMessages(messages, {liveUpdate: true, markAsRead: activelyLookingAtThread})
}

export const applyIncomingMutationToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  valid: T.RPCChat.UIMessageValid,
  modifiedMessage: T.RPCChat.UIMessage | null | undefined,
  actions: ConversationThreadActions
) => {
  const body = valid.messageBody
  logger.info(`Got chat incoming message of messageType: ${body.messageType}`)
  const mutationOrdinal = T.Chat.numberToOrdinal(valid.messageID)
  if (actions.getSnapshot().messageMap.has(mutationOrdinal)) {
    actions.deleteMessages({liveUpdate: true, ordinals: [mutationOrdinal]})
  }

  switch (body.messageType) {
    case T.RPCChat.MessageType.edit:
      if (modifiedMessage) {
        const {username, devicename} = getCurrentUser()
        const modMessage = Message.uiMessageToMessage(
          conversationIDKey,
          modifiedMessage,
          username,
          () => getLastOrdinalFromSnapshot(actions.getSnapshot()),
          devicename
        )
        if (modMessage) {
          actions.addMessages([modMessage], {liveUpdate: true})
        }
      }
      return true
    case T.RPCChat.MessageType.delete: {
      const {delete: d} = body
      if (d.messageIDs) {
        const messageIDs = T.Chat.numbersToMessageIDs(d.messageIDs)
        const snapshot = actions.getSnapshot()
        const isExplodeNow = messageIDs.some(id => {
          const ordinal = getOrdinalForMessageIDInSnapshot(snapshot, id)
          const message = ordinal ? snapshot.messageMap.get(ordinal) : undefined
          return !!((message?.type === 'text' || message?.type === 'attachment') && message.exploding)
        })

        if (isExplodeNow) {
          actions.explodeMessages(messageIDs, valid.senderUsername, true)
        } else {
          actions.deleteMessages({liveUpdate: true, messageIDs})
        }
      }
      return true
    }
    default:
      return false
  }
}

export const applyIncomingMessageToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  incomingMessage: T.RPCChat.IncomingMessage,
  actions: ConversationThreadActions
) => {
  const snapshot = actions.getSnapshot()
  const activelyLookingAtThread = Common.isUserActivelyLookingAtThisThread(conversationIDKey)
  if (!snapshot.loaded && !activelyLookingAtThread) {
    return
  }
  const {message: cMsg, modifiedMessage} = incomingMessage
  const {username, devicename} = getCurrentUser()

  if (
    cMsg.state === T.RPCChat.MessageUnboxedState.outbox &&
    cMsg.outbox.messageType === T.RPCChat.MessageType.reaction
  ) {
    actions.updateOptimisticReactionDecorated(
      T.Chat.stringToOutboxID(cMsg.outbox.outboxID),
      cMsg.outbox.decoratedTextBody ?? cMsg.outbox.body
    )
    return
  }

  if (cMsg.state === T.RPCChat.MessageUnboxedState.valid) {
    const {valid} = cMsg
    const {messageType} = valid.messageBody
    if (
      (messageType === T.RPCChat.MessageType.edit || messageType === T.RPCChat.MessageType.delete) &&
      applyIncomingMutationToThread(conversationIDKey, valid, modifiedMessage, actions)
    ) {
      return
    }
  }

  const message = Message.uiMessageToMessage(
    conversationIDKey,
    cMsg,
    username,
    () => getLastOrdinalFromSnapshot(actions.getSnapshot()),
    devicename
  )
  if (!message) return

  if (
    cMsg.state === T.RPCChat.MessageUnboxedState.valid &&
    cMsg.valid.messageBody.messageType === T.RPCChat.MessageType.attachmentuploaded &&
    message.type === 'attachment'
  ) {
    const placeholderID = cMsg.valid.messageBody.attachmentuploaded.messageID
    const snapshot = actions.getSnapshot()
    const ordinal = getOrdinalForMessageIDInSnapshot(snapshot, T.Chat.numberToMessageID(placeholderID))
    const existing = ordinal ? snapshot.messageMap.get(ordinal) : undefined
    if (ordinal && existing) {
      actions.addMessages([Message.upgradeMessage(existing, {...message, ordinal})], {
        liveUpdate: true,
        markAsRead: activelyLookingAtThread,
      })
    } else {
      if (snapshot.moreToLoadForward) {
        return
      }
      actions.addMessages([message], {liveUpdate: true, markAsRead: activelyLookingAtThread})
    }
  } else {
    if (actions.getSnapshot().moreToLoadForward) {
      return
    }
    actions.addMessages([message], {liveUpdate: true, markAsRead: activelyLookingAtThread})
  }
}

export const applyFailedMessageToThread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  failedMessage: T.RPCChat.FailedMessageInfo,
  actions: ConversationThreadActions
) => {
  const {outboxRecords} = failedMessage
  if (!outboxRecords) return
  for (const outboxRecord of outboxRecords) {
    if (T.Chat.conversationIDToKey(outboxRecord.convID) !== conversationIDKey) {
      continue
    }
    const s = outboxRecord.state
    if (s.state !== T.RPCChat.OutboxStateType.error) {
      continue
    }
    const {error} = s
    const outboxID = T.Chat.rpcOutboxIDToOutboxID(outboxRecord.outboxID)
    actions.setMessageErrored(outboxID, Message.rpcErrorToString(error), error.typ)
  }
}

export const applyReactionUpdateToThread = (
  reactionUpdate: T.RPCChat.ReactionUpdateNotif,
  actions: ConversationThreadActions
) => {
  if (!reactionUpdate.reactionUpdates || reactionUpdate.reactionUpdates.length === 0) {
    return
  }
  const updates = reactionUpdate.reactionUpdates.map(ru => ({
    reactions: Message.reactionMapToReactions(ru.reactions),
    targetMsgID: T.Chat.numberToMessageID(ru.targetMsgID),
  }))
  actions.updateReactions(updates)
}

export const applyExpungeToThread = (expunge: T.RPCChat.ExpungeInfo, actions: ConversationThreadActions) => {
  const deletableMessageTypes =
    useConfigState.getState().chatDeletableByDeleteHistory || Common.allMessageTypes
  actions.deleteMessages({
    deletableMessageTypes,
    liveUpdate: true,
    upToMessageID: T.Chat.numberToMessageID(expunge.expunge.upto),
  })
}

export const applyEphemeralPurgeToThread = (
  ephemeralPurge: T.RPCChat.EphemeralPurgeNotifInfo,
  actions: ConversationThreadActions
) => {
  const messageIDs = ephemeralPurge.msgs?.reduce<Array<T.Chat.MessageID>>((arr, msg) => {
    const msgID = Message.getMessageID(msg)
    if (msgID) {
      arr.push(msgID)
    }
    return arr
  }, [])
  if (messageIDs) {
    actions.explodeMessages(messageIDs, undefined, true)
  }
}

// Applies one notification about this thread's conversation to the thread.
export const applyThreadNotification = (
  id: T.Chat.ConversationIDKey,
  notification: ThreadNotification,
  threadActions: ConversationThreadActions
) => {
  switch (notification.type) {
    case 'incomingMessage':
      applyIncomingMessageToThread(id, notification.incomingMessage, threadActions)
      return
    case 'messagesUpdated':
      applyMessagesUpdatedToThread(id, notification.messagesUpdated, threadActions)
      return
    case 'failedMessage':
      applyFailedMessageToThread(id, notification.failedMessage, threadActions)
      return
    case 'reactionUpdate':
      applyReactionUpdateToThread(notification.reactionUpdate, threadActions)
      return
    case 'expunge':
      applyExpungeToThread(notification.expunge, threadActions)
      return
    case 'ephemeralPurge':
      applyEphemeralPurgeToThread(notification.ephemeralPurge, threadActions)
      return
    case 'requestInfo': {
      const {info, msgID} = notification
      const requestInfo = Message.uiRequestInfoToChatRequestInfo(info)
      if (!requestInfo) {
        logger.error(
          `got 'NotifyChat.ChatRequestInfo' with no valid requestInfo for convID ${id} messageID: ${msgID}. The local version may be absent or out of date.`
        )
        return
      }
      threadActions.receiveRequestInfo(T.Chat.numberToMessageID(msgID), requestInfo)
      return
    }
    case 'paymentInfo': {
      const {info, msgID} = notification
      const paymentInfo = Message.uiPaymentInfoToChatPaymentInfo([info])
      if (!paymentInfo) {
        logger.error(
          `got 'NotifyChat.ChatPaymentInfo' with no valid paymentInfo for convID ${id} messageID: ${msgID}. The local version may be absent or out of date.`
        )
        return
      }
      threadActions.receivePaymentInfo(T.Chat.numberToMessageID(msgID), paymentInfo)
      return
    }
    case 'promptUnfurl':
      threadActions.showUnfurlPrompt(T.Chat.numberToMessageID(notification.msgID), notification.domain)
      return
    case 'coinFlipStatuses':
      threadActions.updateCoinFlipStatuses(notification.statuses)
      return
    case 'typing':
      threadActions.setTyping(new Set(notification.typers?.map(typer => typer.username)))
      return
    case 'attachmentDownloadProgress':
      threadActions.updateAttachmentDownloadProgress(
        notification.msgID,
        notification.bytesComplete,
        notification.bytesTotal
      )
      return
    case 'attachmentDownloadComplete':
      threadActions.completeAttachmentDownload(notification.msgID)
      return
    case 'attachmentUploadProgress':
      threadActions.updateAttachmentUploadProgress(
        notification.outboxID,
        notification.bytesComplete,
        notification.bytesTotal
      )
      return
    default:
  }
}

export const useThreadEngineListeners = (
  id: T.Chat.ConversationIDKey,
  threadActions: ConversationThreadActions
): void => {
  useThreadNotifications(id, notification => {
    applyThreadNotification(id, notification, threadActions)
  })
  // gregor is not a chat notification; it reaches every listener on the engine bus, and a thread
  // whose account has left ignores it like everything else
  useEngineActionListener('keybase.1.gregorUI.pushState', action => {
    const items = (action.payload.params.state.items ?? []).reduce<
      Array<{md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}>
    >((arr, {md, item}) => {
      if (md && item) {
        arr.push({item, md})
      }
      return arr
    }, [])
    const seconds = getExplodingModeFromGregorItems(id, items)
    if (seconds !== undefined) {
      threadActions.setExplodingMode(seconds, true)
    }
  })
}
