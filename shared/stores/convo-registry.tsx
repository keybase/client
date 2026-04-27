import type * as T from '@/constants/types'
import {registerDebugClear} from '@/util/debug'
import {registerExternalResetter} from '@/util/zustand'
import type {StoreApi, UseBoundStore} from 'zustand'
import type {ConvoState} from '@/stores/convostate'

type MadeStore = UseBoundStore<StoreApi<ConvoState>>

export const chatStores: Map<T.Chat.ConversationIDKey, MadeStore> = __DEV__
  ? ((globalThis.__hmr_chatStores ??= new Map()) as Map<T.Chat.ConversationIDKey, MadeStore>)
  : new Map()

export const clearChatStores = () => {
  chatStores.clear()
}

registerDebugClear(() => {
  clearChatStores()
})

registerExternalResetter('convo-registry', clearChatStores)
