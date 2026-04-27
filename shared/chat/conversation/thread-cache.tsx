import type * as T from '@/constants/types'
import {registerDebugClear} from '@/util/debug'
import {registerExternalResetter} from '@/util/zustand'

export type ConversationThreadSnapshot = {
  loaded: boolean
  messageIDToOrdinal: ReadonlyMap<T.Chat.MessageID, T.Chat.Ordinal>
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
  messageTypeMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.RenderMessageType>
  moreToLoadBack: boolean
  moreToLoadForward: boolean
  pendingOutboxToOrdinal: ReadonlyMap<T.Chat.OutboxID, T.Chat.Ordinal>
  validatedOrdinalRange?: {from: T.Chat.Ordinal; to: T.Chat.Ordinal}
}

declare global {
  var __hmr_conversationThreadCache:
    | Map<T.Chat.ConversationIDKey, ConversationThreadSnapshot>
    | undefined
}

const cloneSnapshot = (snapshot: ConversationThreadSnapshot): ConversationThreadSnapshot => ({
  loaded: snapshot.loaded,
  messageIDToOrdinal: new Map(snapshot.messageIDToOrdinal),
  messageMap: new Map(snapshot.messageMap),
  messageOrdinals: snapshot.messageOrdinals ? [...snapshot.messageOrdinals] : undefined,
  messageTypeMap: new Map(snapshot.messageTypeMap),
  moreToLoadBack: snapshot.moreToLoadBack,
  moreToLoadForward: snapshot.moreToLoadForward,
  pendingOutboxToOrdinal: new Map(snapshot.pendingOutboxToOrdinal),
  validatedOrdinalRange: snapshot.validatedOrdinalRange
    ? {...snapshot.validatedOrdinalRange}
    : undefined,
})

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
