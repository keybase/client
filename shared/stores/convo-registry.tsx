import type * as T from '@/constants/types'
import {registerDebugClear} from '@/util/debug'
import {registerExternalResetter} from '@/util/zustand'
import type {StoreApi, UseBoundStore} from 'zustand'
import type {ConvoState, ConvoUIState} from '@/stores/convostate'

type MadeStore = UseBoundStore<StoreApi<ConvoState>>
type MadeUIStore = UseBoundStore<StoreApi<ConvoUIState>>

export const chatStores: Map<T.Chat.ConversationIDKey, MadeStore> = __DEV__
  ? ((globalThis.__hmr_chatStores ??= new Map()) as Map<T.Chat.ConversationIDKey, MadeStore>)
  : new Map()

export const convoUIStores: Map<T.Chat.ConversationIDKey, MadeUIStore> = __DEV__
  ? (((globalThis as any).__hmr_convoUIStores ??= new Map()) as Map<T.Chat.ConversationIDKey, MadeUIStore>)
  : new Map()

export const clearChatStores = () => {
  chatStores.clear()
  convoUIStores.clear()
}

registerDebugClear(() => {
  clearChatStores()
})

registerExternalResetter('convo-registry', clearChatStores)
