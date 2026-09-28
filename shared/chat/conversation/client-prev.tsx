// clientPrev is the newest message the sender knew of when it posted. There are three sources for
// it, and they do not agree, so each caller keeps the one it has always used:
// - getClientPrevFromThread: a thread's loaded rows. Sending, editing and audio from a mounted thread.
// - getClientPrevFromSnapshot: the same rows read from a thread store snapshot. Reactions from a
//   mounted thread. It differs from getClientPrevFromThread only when an ordinal of 0 carries an id:
//   this one then answers 0, the other keeps looking further back.
// - getConversationClientPrev: the inbox meta's maxVisibleMsgID. Anything without a mounted thread,
//   and the attachment title screen.
// Deletes (message and unfurl) and the storeless text send send 0.
import * as T from '@/constants/types'
import {findLast} from '@/util/arrays'
import {getInboxConversationMeta} from '@/chat/inbox/metadata'
import type {ConversationThreadState} from './thread-context'

export const getClientPrevFromThread = (
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>,
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
): T.Chat.MessageID => {
  for (let idx = (messageOrdinals?.length ?? 0) - 1; idx >= 0; --idx) {
    const ordinal = messageOrdinals?.[idx]
    const message = ordinal ? messageMap.get(ordinal) : undefined
    if (message?.id) {
      return message.id
    }
  }
  return T.Chat.numberToMessageID(0)
}

export const getClientPrevFromSnapshot = (snapshot: ConversationThreadState): T.Chat.MessageID => {
  const ordinal = findLast(snapshot.messageOrdinals ?? [], o => {
    const m = snapshot.messageMap.get(o)
    return !!m?.id
  })
  const message = ordinal ? snapshot.messageMap.get(ordinal) : undefined
  return message?.id || T.Chat.numberToMessageID(0)
}

export const getConversationClientPrev = (conversationIDKey: T.Chat.ConversationIDKey) =>
  getInboxConversationMeta(conversationIDKey)?.maxVisibleMsgID ?? T.Chat.numberToMessageID(0)
