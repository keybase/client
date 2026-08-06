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

// `inWindow` tells apart "this row is the oldest thing loaded" (previous is a real gap that a
// scroll-back load can fill) from "we were asked about an ordinal the loaded window doesn't have"
// (a stale item id during list churn), which looks identical from the previous ordinal alone.
const getPreviousOrdinalInfo = (
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>,
  ordinal: T.Chat.Ordinal
) => {
  const idx = findOrdinalIndex(messageOrdinals, ordinal)
  const inWindow = messageOrdinals[idx] === ordinal
  return {inWindow, previous: inWindow && idx > 0 ? messageOrdinals[idx - 1]! : emptyOrdinal}
}

export const getPreviousOrdinal = (
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>,
  ordinal: T.Chat.Ordinal
) => getPreviousOrdinalInfo(messageOrdinals, ordinal).previous

export const getPreviousMessage = (
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>,
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>,
  ordinal: T.Chat.Ordinal
) => {
  const previousOrdinal = getPreviousOrdinal(messageOrdinals, ordinal)
  return previousOrdinal ? messageMap.get(previousOrdinal) : undefined
}

// Username-header behavior. Whether a row shows the author header depends on its PREVIOUS message
// (author grouping), so the oldest row of the loaded window has no previous and must assume it
// leads a group. A scroll-back load then hands it a same-author previous and the header has to go —
// but dropping the header outright shrinks the row ~40px mid-load and the thread jumps. So the row
// keeps the SPACE and loses the CONTENT: `showUsername` is always the currently correct answer
// (empty once the row groups) while `reserveHeader` says a header was already painted here, so the
// row renders it invisibly and its height never changes. shownCache records which rows painted one.
//
// Only non-provisional decisions are recorded. A row whose previous ordinal is in the window but
// whose message is missing or still an unboxing placeholder reads as a different author and shows a
// header it will lose a moment later; that neighbor's own height is about to change anyway, so
// reserving space for it would leave a permanent blank gap where an avatar never belonged. Ditto a
// stale ordinal that isn't in the window at all. The cache is owned per-conversation by the thread
// provider (ShownUsernameCacheContext) and passed in; omitting it (e.g. in tests) disables both the
// recording and the reservation.
export const getMessageShowUsername = (p: {
  message: T.Chat.Message
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  ordinal: T.Chat.Ordinal
  you: string
  shownCache?: Map<T.Chat.Ordinal, string>
}): {reserveHeader: boolean; showUsername: string} => {
  const {message, messageMap, messageOrdinals, ordinal, you, shownCache} = p
  const {inWindow, previous} = getPreviousOrdinalInfo(messageOrdinals, ordinal)
  const previousMessage = previous ? messageMap.get(previous) : undefined
  const showUsername = getUsernameToShow(message, previousMessage, you)
  if (!shownCache) return {reserveHeader: false, showUsername}
  const provisional = !inWindow || (!!previous && (!previousMessage || previousMessage.type === 'placeholder'))
  if (showUsername) {
    if (!provisional) {
      shownCache.set(ordinal, showUsername)
    }
    return {reserveHeader: false, showUsername}
  }
  return {reserveHeader: shownCache.has(ordinal), showUsername}
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
