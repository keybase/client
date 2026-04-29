import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {produce} from 'immer'
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

type ThreadMessagesDeleteParams = {
  messageIDs?: ReadonlyArray<T.Chat.MessageID>
  upToMessageID?: T.Chat.MessageID
  deletableMessageTypes?: ReadonlySet<T.Chat.MessageType>
  ordinals?: ReadonlyArray<T.Chat.Ordinal>
}

type ThreadReactionUpdate = {
  targetMsgID: T.Chat.MessageID
  reactions?: T.Chat.Reactions
}

export const cloneStoreObjectWithImmer = (value: unknown): unknown => {
  if (value instanceof HiddenString) {
    return value
  }
  if (value instanceof Map) {
    return produce(new Map(value), draft => {
      for (const [key, entryValue] of draft) {
        draft.set(key, cloneStoreObjectWithImmer(entryValue))
      }
    })
  }
  if (value instanceof Set) {
    return produce(new Set(value), draft => {
      const entries = [...draft]
      draft.clear()
      entries.forEach(entry => {
        draft.add(cloneStoreObjectWithImmer(entry))
      })
    })
  }
  if (Array.isArray(value)) {
    return produce([...value], draft => {
      const mutableDraft = draft as Array<unknown>
      for (let idx = 0; idx < draft.length; ++idx) {
        mutableDraft[idx] = cloneStoreObjectWithImmer(draft[idx])
      }
    })
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return produce({...value}, draft => {
      const record = draft as Record<string, unknown>
      for (const key of Object.keys(record)) {
        record[key] = cloneStoreObjectWithImmer(record[key])
      }
    })
  }
  return value
}

export const cloneMessageWithImmer = (
  message: T.Chat.Message,
  ordinal: T.Chat.Ordinal = message.ordinal
): T.Chat.Message =>
  produce({...message}, draft => {
    const record = draft as Record<string, unknown>
    for (const key of Object.keys(record)) {
      record[key] = cloneStoreObjectWithImmer(record[key])
    }
    record['ordinal'] = ordinal
  }) as T.Chat.Message

const cloneMessageForThreadState = (
  message: T.Chat.Message,
  ordinal: T.Chat.Ordinal
): WritableDraft<T.Chat.Message> =>
  T.castDraft(cloneMessageWithImmer(message, ordinal))

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

export const removeMessageOrdinalFromThreadState = (
  state: WritableConversationThreadMessageState,
  ordinal: T.Chat.Ordinal,
  knownMessage?: MessageLookup
) => {
  clearMessageIDIndexForOrdinal(state, ordinal, knownMessage)
  state.messageMap.delete(ordinal)
  state.messageTypeMap.delete(ordinal)
  if (state.messageOrdinals) {
    state.messageOrdinals = state.messageOrdinals.filter(o => o !== ordinal)
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

  const getMapOrdinal = (m: T.Chat.Message, regularMessage: boolean) => {
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

  const deletedOrdinals = new Set<T.Chat.Ordinal>()
  for (const _m of messages) {
    const regularMessage = _m.conversationMessage !== false
    const mapOrdinal = getMapOrdinal(_m, regularMessage)
    const getIncomingMessage = (): WritableDraft<T.Chat.Message> =>
      _m.ordinal === mapOrdinal ? T.castDraft(_m) : cloneMessageForThreadState(_m, mapOrdinal)

    if (regularMessage && _m.type === 'deleted') {
      clearMessageIDIndexForOrdinal(state, mapOrdinal)
      state.messageMap.delete(mapOrdinal)
      state.messageTypeMap.delete(mapOrdinal)
      deletedOrdinals.add(mapOrdinal)
    } else {
      if (_m.type === 'placeholder') {
        const old = state.messageMap.get(mapOrdinal)
        if (old && old.type !== 'placeholder') {
          continue
        }
      }

      if (_m.ordinal !== mapOrdinal) {
        // Keep the ordinal list aligned when an outbox/messageID match remaps the message.
        incomingOrdinals.delete(_m.ordinal)
        incomingOrdinals.add(mapOrdinal)
      }

      const existingMsg = state.messageMap.get(mapOrdinal)
      if (existingMsg?.type === _m.type) {
        const m = getIncomingMessage()
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
      const m = cloneMessageForThreadState(_m, mapOrdinal)
      state.messageMap.set(mapOrdinal, m)
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
  for (const ordinal of deletedOrdinals) {
    if (existing.has(ordinal)) {
      existing.delete(ordinal)
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

export const deleteMessagesFromThreadState = (
  state: WritableConversationThreadMessageState,
  p: ThreadMessagesDeleteParams
) => {
  const {deletableMessageTypes, messageIDs = [], ordinals = [], upToMessageID} = p
  const {messageMap} = state

  let upToOrdinals: Array<T.Chat.Ordinal> = []
  if (upToMessageID && deletableMessageTypes) {
    upToOrdinals = [...messageMap.entries()].reduce((arr, [ordinal, m]) => {
      if (m.id < upToMessageID && deletableMessageTypes.has(m.type)) {
        arr.push(ordinal)
      }
      return arr
    }, new Array<T.Chat.Ordinal>())
  }

  const allOrdinals = new Set([
    ...ordinals,
    ...messageIDs.flatMap(id => {
      const o = maybeGetOrdinalByMessageID(state, id)
      return o ? [o] : []
    }),
    ...upToOrdinals,
  ])

  allOrdinals.forEach(ordinal => {
    removeMessageOrdinalFromThreadState(state, ordinal)
  })
}

export const explodeMessagesInThreadState = (
  state: WritableConversationThreadMessageState,
  messageIDs: ReadonlyArray<T.Chat.MessageID>,
  explodedBy?: string
) => {
  messageIDs.forEach(mid => {
    const ordinal = maybeGetOrdinalByMessageID(state, mid)
    const m = ordinal && state.messageMap.get(ordinal)
    if (!m) return
    m.exploded = true
    m.explodedBy = explodedBy || ''
    m.reactions = new Map()
    m.unfurls = new Map()
    if (m.type === 'text') {
      m.flipGameID = ''
      m.mentionsAt = new Set()
      m.text = new HiddenString('')
    }
  })
}

export const setMessageErroredInThreadState = (
  state: WritableConversationThreadMessageState,
  outboxID: T.Chat.OutboxID,
  reason: string,
  errorTyp?: number
) => {
  const ordinal = state.pendingOutboxToOrdinal.get(outboxID)
  const m = ordinal ? state.messageMap.get(ordinal) : undefined
  if (!m) return
  m.errorReason = reason
  m.errorTyp = errorTyp || undefined
  m.submitState = 'failed'
}

export const toggleLocalReactionInThreadState = (
  state: WritableConversationThreadMessageState,
  p: {
    decorated: string
    emoji: string
    targetOrdinal: T.Chat.Ordinal
    username: string
  }
) => {
  const {decorated, emoji, targetOrdinal, username} = p
  const m = state.messageMap.get(targetOrdinal)
  if (m && Message.isMessageWithReactions(m)) {
    if (!m.reactions) {
      m.reactions = new Map()
    }
    const existing = m.reactions.get(emoji)
    if (existing) {
      const userIndex = existing.users.findIndex(u => u.username === username)
      if (userIndex >= 0) {
        existing.users = existing.users.filter(u => u.username !== username)
        if (existing.users.length === 0) {
          m.reactions.delete(emoji)
        }
      } else {
        existing.users = [...existing.users, {timestamp: Date.now(), username}]
      }
    } else {
      m.reactions.set(emoji, {
        decorated,
        users: [{timestamp: Date.now(), username}],
      })
    }
  }
}

export const updateReactionsInThreadState = (
  state: WritableConversationThreadMessageState,
  updates: ReadonlyArray<ThreadReactionUpdate>
) => {
  const missingTargetMsgIDs = new Array<T.Chat.MessageID>()
  for (const u of updates) {
    const reactions = u.reactions
    const targetMsgID = u.targetMsgID
    const targetOrdinal = maybeGetOrdinalByMessageID(state, targetMsgID)
    if (!targetOrdinal) {
      missingTargetMsgIDs.push(targetMsgID)
      continue
    }
    const m = state.messageMap.get(targetOrdinal)
    if (m && m.type !== 'deleted' && m.type !== 'placeholder') {
      if (!reactions) {
        m.reactions = undefined
      } else if (!m.reactions) {
        m.reactions = T.castDraft(reactions)
      } else {
        const existingOrder = [...m.reactions.keys()]
        const scoreMap = new Map(
          [...reactions.entries()].map(([key, value]) => {
            return [
              key,
              value.users.reduce(
                (minTimestamp, reaction) => Math.min(minTimestamp, reaction.timestamp),
                Infinity
              ),
            ]
          })
        )
        const newReactions = new Map<string, T.Chat.ReactionDesc>()
        for (const emoji of existingOrder) {
          if (reactions.has(emoji)) {
            newReactions.set(emoji, reactions.get(emoji)!)
          }
        }
        const remainingEmojis = [...reactions.keys()].filter(emoji => !newReactions.has(emoji))
        remainingEmojis.sort((a, b) => scoreMap.get(a)! - scoreMap.get(b)!)
        for (const emoji of remainingEmojis) {
          newReactions.set(emoji, reactions.get(emoji)!)
        }
        m.reactions = T.castDraft(newReactions)
      }
    }
  }
  return missingTargetMsgIDs
}

export const updateAttachmentDownloadProgressInThreadState = (
  state: WritableConversationThreadMessageState,
  msgID: number,
  bytesComplete: number,
  bytesTotal: number
) => {
  const ratio = bytesComplete / bytesTotal
  const ordinal = maybeGetOrdinalByMessageID(state, T.Chat.numberToMessageID(msgID))
  if (!ordinal) return false
  const m = state.messageMap.get(ordinal)
  if (m?.type !== 'attachment') return false

  if (!m.downloadPath && m.transferProgress !== 1) {
    m.transferErrMsg = undefined
    m.transferProgress = ratio
    m.transferState = 'downloading'
  }
  return true
}

export const retryMessageInThreadState = (
  state: WritableConversationThreadMessageState,
  outboxID: T.Chat.OutboxID
) => {
  const ordinal = state.pendingOutboxToOrdinal.get(outboxID)
  if (!ordinal || !state.messageMap.get(ordinal)) {
    return false
  }
  const message = state.messageMap.get(ordinal)
  if (message) {
    message.errorReason = undefined
    message.submitState = 'pending'
  }
  return true
}

export const setMessageSubmitStateInThreadState = (
  state: WritableConversationThreadMessageState,
  ordinal: T.Chat.Ordinal,
  submitState: T.Chat.Message['submitState']
) => {
  const message = state.messageMap.get(ordinal)
  if (message) {
    message.submitState = submitState
  }
}

export const completeAttachmentDownloadInThreadState = (
  state: WritableConversationThreadMessageState,
  msgID: number
) => {
  const ordinal = maybeGetOrdinalByMessageID(state, T.Chat.numberToMessageID(msgID))
  if (!ordinal) return false
  const m = state.messageMap.get(ordinal)
  if (m?.type !== 'attachment') return false
  m.transferProgress = 0
  m.transferState = undefined
  return true
}

export const updateAttachmentUploadProgressInThreadState = (
  state: WritableConversationThreadMessageState,
  outboxID: Uint8Array,
  bytesComplete = 0,
  bytesTotal?: number
) => {
  const ordinal = state.pendingOutboxToOrdinal.get(T.Chat.rpcOutboxIDToOutboxID(outboxID))
  if (!ordinal) return false
  const m = state.messageMap.get(ordinal)
  if (m?.type !== 'attachment') return false
  m.transferProgress = bytesTotal ? bytesComplete / bytesTotal : 0.01
  m.transferState = 'uploading'
  return true
}

export const startAttachmentDownloadInThreadState = (
  state: WritableConversationThreadMessageState,
  ordinal: T.Chat.Ordinal
) => {
  const m = state.messageMap.get(ordinal)
  if (!m) return false
  m.transferErrMsg = m.type === 'attachment' ? undefined : 'Trying to download missing / incorrect message?'
  m.transferState = m.type === 'attachment' ? 'downloading' : undefined
  return m.type === 'attachment'
}

export const finishAttachmentDownloadInThreadState = (
  state: WritableConversationThreadMessageState,
  ordinal: T.Chat.Ordinal,
  path: string
) => {
  const m = state.messageMap.get(ordinal)
  if (m?.type !== 'attachment') return false
  m.downloadPath = path
  m.fileURLCached = true
  m.transferErrMsg = undefined
  m.transferProgress = 1
  m.transferState = undefined
  return true
}

export const failAttachmentDownloadInThreadState = (
  state: WritableConversationThreadMessageState,
  ordinal: T.Chat.Ordinal,
  errMsg: string
) => {
  const m = state.messageMap.get(ordinal)
  if (m?.type !== 'attachment') return false
  m.downloadPath = ''
  m.fileURLCached = true
  m.transferErrMsg = errMsg
  m.transferProgress = 0
  m.transferState = undefined
  return true
}

export const setAttachmentMobileSavingInThreadState = (
  state: WritableConversationThreadMessageState,
  ordinal: T.Chat.Ordinal,
  saving: boolean
) => {
  const m = state.messageMap.get(ordinal)
  if (m?.type !== 'attachment') return false
  m.transferErrMsg = undefined
  m.transferState = saving ? 'mobileSaving' : undefined
  return true
}
