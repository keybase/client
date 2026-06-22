import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import {getUsernameToShow} from './separator-utils'

const emptyOrdinal = T.Chat.numberToOrdinal(0)

const findOrdinalIndex = (ordinals: ReadonlyArray<T.Chat.Ordinal>, ordinal: T.Chat.Ordinal) => {
  let low = 0
  let high = ordinals.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (ordinals[mid]! < ordinal) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

export const getPreviousOrdinal = (
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>,
  ordinal: T.Chat.Ordinal
) => {
  const idx = findOrdinalIndex(messageOrdinals, ordinal)
  return messageOrdinals[idx] === ordinal && idx > 0 ? messageOrdinals[idx - 1]! : emptyOrdinal
}

export const getPreviousMessage = (
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>,
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>,
  ordinal: T.Chat.Ordinal
) => {
  const previousOrdinal = getPreviousOrdinal(messageOrdinals, ordinal)
  return previousOrdinal ? messageMap.get(previousOrdinal) : undefined
}

// Sticky username-header cache. Whether a row shows the author header depends on its PREVIOUS
// message (author grouping). When older messages load in (scroll-back pagination), a row's previous
// changes from missing/placeholder to a real same-author message, which would collapse the header
// and shrink the row — making the thread jump. Once a row has shown the header we keep showing it,
// even if a later-loaded previous would group it away, so already-rendered rows never change height.
// Keyed by conversation; cleared in thread-context messagesClear.
const everShownUsername = new Map<string, Map<T.Chat.Ordinal, string>>()

export const clearShownUsernameCache = (conversationIDKey: T.Chat.ConversationIDKey) => {
  everShownUsername.delete(conversationIDKey)
}

export const getMessageShowUsername = (p: {
  message: T.Chat.Message
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  ordinal: T.Chat.Ordinal
  you: string
}) => {
  const {message, messageMap, messageOrdinals, ordinal, you} = p
  const result = getUsernameToShow(message, getPreviousMessage(messageOrdinals, messageMap, ordinal), you)
  const conversationIDKey = message.conversationIDKey
  if (result) {
    let shown = everShownUsername.get(conversationIDKey)
    if (!shown) {
      shown = new Map()
      everShownUsername.set(conversationIDKey, shown)
    }
    shown.set(ordinal, result)
    return result
  }
  // sticky: if this row previously showed the author, keep it rather than collapsing on load
  return everShownUsername.get(conversationIDKey)?.get(ordinal) ?? result
}

export const getMessageRowRecycleType = (
  message: T.Chat.Message,
  renderType?: T.Chat.RenderMessageType
): string | undefined => {
  const baseType =
    message.type === 'attachment' ? message.type : (renderType ?? Message.getMessageRenderType(message))
  let rowRecycleType = baseType
  let needsSpecificRecycleType = false

  if (
    (message.type === 'text' || message.type === 'attachment') &&
    (message.submitState === 'pending' || message.submitState === 'failed')
  ) {
    rowRecycleType += ':pending'
    needsSpecificRecycleType = true
  }

  if (message.type === 'text' && message.replyTo) {
    rowRecycleType += ':reply'
    needsSpecificRecycleType = true
  }
  if (message.reactions?.size) {
    rowRecycleType += ':reactions'
    needsSpecificRecycleType = true
  }

  return needsSpecificRecycleType ? rowRecycleType : undefined
}

export const getMessageRowType = (message: T.Chat.Message, renderType?: T.Chat.RenderMessageType) =>
  getMessageRowRecycleType(message, renderType) ?? renderType ?? Message.getMessageRenderType(message)
