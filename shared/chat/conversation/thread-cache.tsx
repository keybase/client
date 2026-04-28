import type * as T from '@/constants/types'
import {registerDebugClear} from '@/util/debug'
import {registerExternalResetter} from '@/util/zustand'
import {produce} from 'immer'
import {cloneMessageWithImmer, cloneStoreObjectWithImmer} from './thread-message-state'

export type ConversationThreadSnapshot = {
  accountsInfoMap: ReadonlyMap<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>
  explodingMode: number
  flipStatusMap: ReadonlyMap<string, T.RPCChat.UICoinFlipStatus>
  loaded: boolean
  meta: T.Chat.ConversationMeta
  messageIDToOrdinal: ReadonlyMap<T.Chat.MessageID, T.Chat.Ordinal>
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
  messageTypeMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.RenderMessageType>
  moreToLoadBack: boolean
  moreToLoadForward: boolean
  paymentStatusMap: ReadonlyMap<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo>
  participants: T.Chat.ParticipantInfo
  pendingOutboxToOrdinal: ReadonlyMap<T.Chat.OutboxID, T.Chat.Ordinal>
  unfurlPrompt: ReadonlyMap<T.Chat.MessageID, ReadonlySet<string>>
  validatedOrdinalRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
}

const cloneMeta = (meta: T.Chat.ConversationMeta): T.Chat.ConversationMeta =>
  produce(
    {
      ...meta,
      rekeyers: new Set(meta.rekeyers),
      resetParticipants: new Set(meta.resetParticipants),
    },
    () => {}
  )

const cloneParticipants = (participants: T.Chat.ParticipantInfo): T.Chat.ParticipantInfo =>
  produce(
    {
      all: [...participants.all],
      contactName: new Map(participants.contactName),
      name: [...participants.name],
    },
    () => {}
  )

const cloneMapWithImmer = <K, V>(map: ReadonlyMap<K, V>): Map<K, V> => {
  const next = new Map<K, V>()
  for (const [key, value] of map) {
    next.set(key, cloneStoreObjectWithImmer(value) as V)
  }
  return next
}

const cloneMessageMap = (
  map: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
): Map<T.Chat.Ordinal, T.Chat.Message> => {
  const next = new Map<T.Chat.Ordinal, T.Chat.Message>()
  for (const [ordinal, message] of map) {
    next.set(ordinal, cloneMessageWithImmer(message, ordinal))
  }
  return next
}

declare global {
  var __hmr_conversationThreadCache:
    | Map<T.Chat.ConversationIDKey, ConversationThreadSnapshot>
    | undefined
}

const cloneSnapshot = (snapshot: ConversationThreadSnapshot): ConversationThreadSnapshot =>
  produce(
    {
      accountsInfoMap: cloneMapWithImmer(snapshot.accountsInfoMap),
      explodingMode: snapshot.explodingMode,
      flipStatusMap: cloneMapWithImmer(snapshot.flipStatusMap),
      loaded: snapshot.loaded,
      messageIDToOrdinal: new Map(snapshot.messageIDToOrdinal),
      messageMap: cloneMessageMap(snapshot.messageMap),
      messageOrdinals: snapshot.messageOrdinals ? produce([...snapshot.messageOrdinals], () => {}) : undefined,
      messageTypeMap: new Map(snapshot.messageTypeMap),
      meta: cloneMeta(snapshot.meta),
      moreToLoadBack: snapshot.moreToLoadBack,
      moreToLoadForward: snapshot.moreToLoadForward,
      participants: cloneParticipants(snapshot.participants),
      paymentStatusMap: cloneMapWithImmer(snapshot.paymentStatusMap),
      pendingOutboxToOrdinal: new Map(snapshot.pendingOutboxToOrdinal),
      unfurlPrompt: cloneMapWithImmer(snapshot.unfurlPrompt),
      validatedOrdinalRange: snapshot.validatedOrdinalRange
        ? produce({...snapshot.validatedOrdinalRange}, () => {})
        : undefined,
    },
    () => {}
  )

const cache: Map<T.Chat.ConversationIDKey, ConversationThreadSnapshot> = __DEV__
  ? (globalThis.__hmr_conversationThreadCache ??= new Map())
  : new Map()

export const getConversationThreadCacheSnapshot = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const snapshot = cache.get(conversationIDKey)
  return snapshot ? cloneSnapshot(snapshot) : undefined
}

export const putConversationThreadCacheSnapshot = (
  conversationIDKey: T.Chat.ConversationIDKey,
  snapshot: ConversationThreadSnapshot
) => {
  cache.set(conversationIDKey, cloneSnapshot(snapshot))
}

export const deleteConversationThreadCacheSnapshot = (conversationIDKey: T.Chat.ConversationIDKey) => {
  cache.delete(conversationIDKey)
}

export const clearConversationThreadCache = () => {
  cache.clear()
}

registerDebugClear(clearConversationThreadCache)
registerExternalResetter('conversation-thread-cache', clearConversationThreadCache)
