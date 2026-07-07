import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useEngineActionListener} from '@/engine/action-listener'
import {
  getCurrentUser,
  getExplodingModeFromGregorItems,
  getLastOrdinalFromSnapshot,
  getOrdinalForMessageIDInSnapshot,
} from './thread-load'
import type {ConversationThreadActions} from './thread-context'

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

export const useThreadEngineListeners = (
  id: T.Chat.ConversationIDKey,
  threadActions: ConversationThreadActions
): void => {
  useEngineActionListener('chat.1.NotifyChat.NewChatActivity', action => {
    const {activity} = action.payload.params
    switch (activity.activityType) {
      case T.RPCChat.ChatActivityType.incomingMessage: {
        const {incomingMessage} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(incomingMessage.convID)
        if (conversationIDKey === id) {
          applyIncomingMessageToThread(conversationIDKey, incomingMessage, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.messagesUpdated: {
        const {messagesUpdated} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(messagesUpdated.convID)
        if (conversationIDKey === id) {
          applyMessagesUpdatedToThread(conversationIDKey, messagesUpdated, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.failedMessage: {
        const {failedMessage} = activity
        applyFailedMessageToThread(id, failedMessage, threadActions)
        break
      }
      case T.RPCChat.ChatActivityType.reactionUpdate: {
        const {reactionUpdate} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(reactionUpdate.convID)
        if (conversationIDKey === id) {
          applyReactionUpdateToThread(reactionUpdate, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.expunge: {
        const {expunge} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(expunge.convID)
        if (conversationIDKey === id) {
          applyExpungeToThread(expunge, threadActions)
        }
        break
      }
      case T.RPCChat.ChatActivityType.ephemeralPurge: {
        const {ephemeralPurge} = activity
        const conversationIDKey = T.Chat.conversationIDToKey(ephemeralPurge.convID)
        if (conversationIDKey === id) {
          applyEphemeralPurgeToThread(ephemeralPurge, threadActions)
        }
        break
      }
      default:
    }
  })
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
  useEngineActionListener('chat.1.NotifyChat.ChatRequestInfo', action => {
    const {convID, info, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    const requestInfo = Message.uiRequestInfoToChatRequestInfo(info)
    if (!requestInfo) {
      logger.error(
        `got 'NotifyChat.ChatRequestInfo' with no valid requestInfo for convID ${id} messageID: ${msgID}. The local version may be absent or out of date.`
      )
      return
    }
    threadActions.receiveRequestInfo(T.Chat.numberToMessageID(msgID), requestInfo)
  })
  useEngineActionListener('chat.1.NotifyChat.ChatPaymentInfo', action => {
    const {convID, info, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    const paymentInfo = Message.uiPaymentInfoToChatPaymentInfo([info])
    if (!paymentInfo) {
      logger.error(
        `got 'NotifyChat.ChatPaymentInfo' with no valid paymentInfo for convID ${id} messageID: ${msgID}. The local version may be absent or out of date.`
      )
      return
    }
    threadActions.receivePaymentInfo(T.Chat.numberToMessageID(msgID), paymentInfo)
  })
  useEngineActionListener('chat.1.NotifyChat.ChatPromptUnfurl', action => {
    const {convID, domain, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) !== id) {
      return
    }
    threadActions.showUnfurlPrompt(T.Chat.numberToMessageID(msgID), domain)
  })
  useEngineActionListener('chat.1.chatUi.chatCoinFlipStatus', action => {
    const statuses = action.payload.params.statuses?.filter(status => {
      return T.Chat.stringToConversationIDKey(status.convID) === id
    })
    if (statuses?.length) {
      threadActions.updateCoinFlipStatuses(statuses)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatTypingUpdate', action => {
    action.payload.params.typingUpdates?.forEach(update => {
      if (T.Chat.conversationIDToKey(update.convID) === id) {
        threadActions.setTyping(new Set(update.typers?.map(typer => typer.username)))
      }
    })
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentDownloadProgress', action => {
    const {bytesComplete, bytesTotal, convID, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) === id) {
      threadActions.updateAttachmentDownloadProgress(msgID, bytesComplete, bytesTotal)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentDownloadComplete', action => {
    const {convID, msgID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) === id) {
      threadActions.completeAttachmentDownload(msgID)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentUploadStart', action => {
    const {convID, outboxID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) === id) {
      threadActions.updateAttachmentUploadProgress(outboxID)
    }
  })
  useEngineActionListener('chat.1.NotifyChat.ChatAttachmentUploadProgress', action => {
    const {bytesComplete, bytesTotal, convID, outboxID} = action.payload.params
    if (T.Chat.conversationIDToKey(convID) === id) {
      threadActions.updateAttachmentUploadProgress(outboxID, bytesComplete, bytesTotal)
    }
  })
}
