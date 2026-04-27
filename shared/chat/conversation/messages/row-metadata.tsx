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

export const getMessageShowUsername = (p: {
  message: T.Chat.Message
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  ordinal: T.Chat.Ordinal
  you: string
}) => {
  const {message, messageMap, messageOrdinals, ordinal, you} = p
  return getUsernameToShow(message, getPreviousMessage(messageOrdinals, messageMap, ordinal), you)
}

export const getMessageRowRecycleType = (
  message: T.Chat.Message,
  renderType?: T.Chat.RenderMessageType
): string | undefined => {
  let rowRecycleType = renderType ?? Message.getMessageRenderType(message)
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
