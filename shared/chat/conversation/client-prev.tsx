// clientPrev is the newest message the sender knew of when it posted:
// - getClientPrevFromThread: the newest loaded row with an id. Anything sent from a mounted thread.
// - getConversationClientPrev: the inbox meta's maxVisibleMsgID. Anything without a mounted thread,
//   and the attachment title screen.
// Deletes (message and unfurl) and the storeless text send send 0.
import * as T from '@/constants/types'
import {getInboxConversationMeta} from '@/chat/inbox/metadata'

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

export const getConversationClientPrev = (conversationIDKey: T.Chat.ConversationIDKey) =>
  getInboxConversationMeta(conversationIDKey)?.maxVisibleMsgID ?? T.Chat.numberToMessageID(0)
