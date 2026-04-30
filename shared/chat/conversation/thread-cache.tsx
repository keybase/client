import type * as T from '@/constants/types'
import {registerDebugClear} from '@/util/debug'
import {registerExternalResetter} from '@/util/zustand'

// Flip to true to measure cold thread loads without the snapshot cache.
const disableConversationThreadCache = false

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

declare global {
  var __hmr_conversationThreadCache:
    | Map<T.Chat.ConversationIDKey, ConversationThreadSnapshot>
    | undefined
}

const cache: Map<T.Chat.ConversationIDKey, ConversationThreadSnapshot> = __DEV__
  ? (globalThis.__hmr_conversationThreadCache ??= new Map())
  : new Map()

export const getConversationThreadCacheSnapshot = (conversationIDKey: T.Chat.ConversationIDKey) => {
  if (disableConversationThreadCache) {
    return undefined
  }
  return cache.get(conversationIDKey)
}

export const putConversationThreadCacheSnapshot = (
  conversationIDKey: T.Chat.ConversationIDKey,
  snapshot: ConversationThreadSnapshot
) => {
  if (disableConversationThreadCache) {
    return
  }
  cache.set(conversationIDKey, snapshot)
}

export const deleteConversationThreadCacheSnapshot = (conversationIDKey: T.Chat.ConversationIDKey) => {
  cache.delete(conversationIDKey)
}

export const clearConversationThreadCache = () => {
  cache.clear()
}

registerDebugClear(clearConversationThreadCache)
registerExternalResetter('conversation-thread-cache', clearConversationThreadCache)
