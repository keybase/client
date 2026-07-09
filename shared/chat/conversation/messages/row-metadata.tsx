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

// Sticky username-header behavior. Whether a row shows the author header depends on its PREVIOUS
// message (author grouping). When older messages load in (scroll-back pagination), a row's previous
// changes from missing/placeholder to a real same-author message, which would collapse the header
// and shrink the row — making the thread jump. Once a row has shown the header we keep showing it,
// even if a later-loaded previous would group it away, so already-rendered rows never change height.
// The cache is owned per-conversation by the thread provider (ShownUsernameCacheContext) and passed
// in; omitting it (e.g. in tests) just disables stickiness.
export const getMessageShowUsername = (p: {
  message: T.Chat.Message
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  ordinal: T.Chat.Ordinal
  you: string
  shownCache?: Map<T.Chat.Ordinal, string>
}) => {
  const {message, messageMap, messageOrdinals, ordinal, you, shownCache} = p
  const result = getUsernameToShow(message, getPreviousMessage(messageOrdinals, messageMap, ordinal), you)
  if (!shownCache) return result
  if (result) {
    shownCache.set(ordinal, result)
    return result
  }
  // sticky: if this row previously showed the author, keep it rather than collapsing on load
  return shownCache.get(ordinal) ?? result
}

export const getMessageRowRecycleType = (
  message: T.Chat.Message,
  renderType?: T.Chat.RenderMessageType
): string | undefined => {
  const baseType =
    message.type === 'attachment' ? message.type : (renderType ?? Message.getMessageRenderType(message))
  let rowRecycleType = baseType
  let needsSpecificRecycleType = false

  // Only suffixes that are stable for the message's lifetime: the recycling pool label is recorded
  // when a container is allocated and never updated on in-place changes, so a suffix that can flip
  // (pending → confirmed after every send, reactions toggling on and off) leaves stale pool labels
  // behind and recycled containers paint at the wrong pooled height. 'failed' is sticky until an
  // explicit retry and 'reply' never changes.
  if ((message.type === 'text' || message.type === 'attachment') && message.submitState === 'failed') {
    rowRecycleType += ':failed'
    needsSpecificRecycleType = true
  }

  if (message.type === 'text' && message.replyTo) {
    rowRecycleType += ':reply'
    needsSpecificRecycleType = true
  }

  return needsSpecificRecycleType ? rowRecycleType : undefined
}

export const getMessageRowType = (message: T.Chat.Message, renderType?: T.Chat.RenderMessageType) =>
  getMessageRowRecycleType(message, renderType) ?? renderType ?? Message.getMessageRenderType(message)
