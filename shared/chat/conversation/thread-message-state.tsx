import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import type {WritableDraft} from '@/util/zustand'

type MessageLookup = Pick<T.Chat.Message, 'id' | 'ordinal'>

type WritableConversationThreadMessageState = {
  messageIDToOrdinal: Map<T.Chat.MessageID, T.Chat.Ordinal>
  messageMap: Map<T.Chat.Ordinal, WritableDraft<T.Chat.Message>>
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
  messageTypeMap: Map<T.Chat.Ordinal, T.Chat.RenderMessageType>
  pendingOutboxToOrdinal: Map<T.Chat.OutboxID, T.Chat.Ordinal>
  validatedOrdinalRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
}

export const getOrdinalForMessageID = (
  map: ReadonlyMap<T.Chat.Ordinal, MessageLookup>,
  pendingOutboxToOrdinal: ReadonlyMap<T.Chat.OutboxID, T.Chat.Ordinal> | undefined,
  messageID: T.Chat.MessageID,
  indexed?: ReadonlyMap<T.Chat.MessageID, T.Chat.Ordinal>
) => {
  const indexedOrdinal = indexed?.get(messageID)
  if (indexedOrdinal !== undefined && map.get(indexedOrdinal)?.id === messageID) {
    return indexedOrdinal
  }

  let m = map.get(T.Chat.numberToOrdinal(messageID))
  if (m?.id !== 0 && m?.id === messageID) {
    return m.ordinal
  }

  if (pendingOutboxToOrdinal) {
    for (const ordinal of pendingOutboxToOrdinal.values()) {
      m = map.get(ordinal)
      if (m?.id !== 0 && m?.id === messageID) {
        return ordinal
      }
    }
  }

  return null
}

export const clearMessageIDIndexForOrdinal = (
  state: Pick<WritableConversationThreadMessageState, 'messageIDToOrdinal'> & {
    messageMap: ReadonlyMap<T.Chat.Ordinal, MessageLookup>
  },
  ordinal: T.Chat.Ordinal,
  knownMessage?: MessageLookup
) => {
  const message = knownMessage ?? state.messageMap.get(ordinal)
  if (message?.id) {
    state.messageIDToOrdinal.delete(message.id)
  }
}

const indexMessage = (
  state: Pick<WritableConversationThreadMessageState, 'messageIDToOrdinal'>,
  ordinal: T.Chat.Ordinal,
  message: WritableDraft<T.Chat.Message>
) => {
  if (message.id) {
    state.messageIDToOrdinal.set(message.id, ordinal)
  }
}

const maybeGetOrdinalByMessageID = (
  state: Pick<
    WritableConversationThreadMessageState,
    'messageIDToOrdinal' | 'messageMap' | 'pendingOutboxToOrdinal'
  >,
  messageID: T.Chat.MessageID
) =>
  getOrdinalForMessageID(state.messageMap, state.pendingOutboxToOrdinal, messageID, state.messageIDToOrdinal)

const mergeMessage = (
  existing: WritableDraft<T.Chat.Message>,
  incoming: WritableDraft<T.Chat.Message>
) => {
  const existingRecord = existing as Record<string, unknown>
  const incomingRecord = incoming as Record<string, unknown>
  const allKeys = new Set([...Object.keys(existingRecord), ...Object.keys(incomingRecord)])
  for (const key of allKeys) {
    const val = incomingRecord[key]
    const cur = existingRecord[key]
    if (val instanceof HiddenString) {
      if (!(cur instanceof HiddenString) || !val.equals(cur)) {
        existingRecord[key] = val
      }
    } else if (val instanceof Map) {
      if (cur instanceof Map) {
        for (const k of (cur as Map<unknown, unknown>).keys()) {
          if (!(val as Map<unknown, unknown>).has(k)) {
            ;(cur as Map<unknown, unknown>).delete(k)
          }
        }
        for (const [k, v] of val as Map<unknown, unknown>) {
          ;(cur as Map<unknown, unknown>).set(k, v)
        }
      } else {
        existingRecord[key] = val
      }
    } else if (cur !== val) {
      existingRecord[key] = val
    }
  }
}

export const addMessagesToThreadState = (
  state: WritableConversationThreadMessageState,
  messages: ReadonlyArray<T.Chat.Message>,
  opt: {validatedRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}}
) => {
  const {validatedRange} = opt
  const incomingOrdinals = new Set<T.Chat.Ordinal>()
  for (const m of messages) {
    if (m.conversationMessage !== false && m.type !== 'deleted') {
      incomingOrdinals.add(m.ordinal)
    }
  }

  const getMapOrdinal = (m: WritableDraft<T.Chat.Message>, regularMessage: boolean) => {
    let mapOrdinal = m.ordinal
    if (regularMessage && m.outboxID) {
      const existingSent = state.pendingOutboxToOrdinal.get(m.outboxID)
      if (existingSent) {
        mapOrdinal = existingSent
      }
    }
    if (regularMessage && mapOrdinal === m.ordinal && m.id) {
      const existingByMessageID = maybeGetOrdinalByMessageID(state, m.id)
      if (existingByMessageID) {
        mapOrdinal = existingByMessageID
      }
    }
    return mapOrdinal
  }

  for (const _m of messages) {
    const m = T.castDraft(_m)
    const regularMessage = m.conversationMessage !== false

    if (regularMessage && m.type === 'deleted') {
      const mapOrdinal = getMapOrdinal(m, regularMessage)
      if (m.ordinal !== mapOrdinal) {
        m.ordinal = mapOrdinal
      }
      clearMessageIDIndexForOrdinal(state, mapOrdinal)
      state.messageMap.delete(mapOrdinal)
      state.messageTypeMap.delete(mapOrdinal)
    } else {
      const mapOrdinal = getMapOrdinal(m, regularMessage)
      if (m.type === 'placeholder') {
        const old = state.messageMap.get(mapOrdinal)
        if (old && old.type !== 'placeholder') {
          continue
        }
      }

      if (m.ordinal !== mapOrdinal) {
        // Keep the ordinal list aligned when an outbox/messageID match remaps the message.
        if (regularMessage && m.type !== 'deleted') {
          incomingOrdinals.delete(m.ordinal)
          incomingOrdinals.add(mapOrdinal)
        }
        m.ordinal = mapOrdinal
      }

      const existingMsg = state.messageMap.get(mapOrdinal)
      if (existingMsg?.type === m.type) {
        if (existingMsg.id && existingMsg.id !== m.id) {
          state.messageIDToOrdinal.delete(existingMsg.id)
        }
        mergeMessage(existingMsg, m)
        indexMessage(state, mapOrdinal, existingMsg)
        if (m.type !== 'text') {
          state.messageTypeMap.set(mapOrdinal, Message.getMessageRenderType(m))
        }
        continue
      }

      if (existingMsg) {
        clearMessageIDIndexForOrdinal(state, mapOrdinal, existingMsg)
      }
      state.messageMap.set(mapOrdinal, T.castDraft(m))
      indexMessage(state, mapOrdinal, m)
      if (
        regularMessage &&
        m.outboxID &&
        T.Chat.messageIDToNumber(m.id) !== T.Chat.ordinalToNumber(m.ordinal)
      ) {
        state.pendingOutboxToOrdinal.set(m.outboxID, mapOrdinal)
      }
      if (m.type === 'text') {
        state.messageTypeMap.delete(mapOrdinal)
      } else {
        state.messageTypeMap.set(mapOrdinal, Message.getMessageRenderType(m))
      }
    }
  }

  const existing = new Set(state.messageOrdinals ?? [])
  let changed = false
  for (const o of incomingOrdinals) {
    if (!existing.has(o)) {
      existing.add(o)
      changed = true
    }
  }
  for (const _m of messages) {
    const m = T.castDraft(_m)
    if (m.conversationMessage !== false && m.type === 'deleted' && existing.has(m.ordinal)) {
      existing.delete(m.ordinal)
      changed = true
    }
  }
  if (validatedRange) {
    // The service response is authoritative within this range; prune stale local ordinals.
    for (const o of existing) {
      if (o >= validatedRange.from && o <= validatedRange.to && !incomingOrdinals.has(o)) {
        clearMessageIDIndexForOrdinal(state, o)
        existing.delete(o)
        state.messageMap.delete(o)
        state.messageTypeMap.delete(o)
        changed = true
      }
    }
    const prev = state.validatedOrdinalRange
    state.validatedOrdinalRange = prev
      ? {
          from: Math.min(prev.from, validatedRange.from) as T.Chat.Ordinal,
          to: Math.max(prev.to, validatedRange.to) as T.Chat.Ordinal,
        }
      : validatedRange
  }
  if (changed || !state.messageOrdinals) {
    state.messageOrdinals = [...existing].sort((a, b) => a - b)
  }
}
