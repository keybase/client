import * as C from '@/constants'
import * as T from '@/constants/types'
import {isPhone} from '@/constants/platform'
import {navigateToInbox, setChatRootParams} from '@/constants/router'
import {refreshConversationParticipants} from '@/chat/inbox/refresh-participants'
import {getChatRpc, type ChatThreadRpc} from './chat-rpc'

const setConversationStatusPromise = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  status: T.RPCChat.ConversationStatus
) => {
  await getChatRpc().setConversationStatus(conversationIDKey, status)
}

const setConversationStatus = (
  conversationIDKey: T.Chat.ConversationIDKey,
  status: T.RPCChat.ConversationStatus
) => {
  C.ignorePromise(setConversationStatusPromise(conversationIDKey, status))
}

export const hideConversation = (conversationIDKey: T.Chat.ConversationIDKey, hide: boolean) => {
  if (hide) {
    navigateToInbox()
    if (!isPhone) {
      setChatRootParams({conversationIDKey, infoPanel: undefined})
    }
  }
  setConversationStatus(
    conversationIDKey,
    hide ? T.RPCChat.ConversationStatus.ignored : T.RPCChat.ConversationStatus.unfiled
  )
}

// rpc: a thread screen's own (useThreadRpc)
export const joinConversation = (conversationIDKey: T.Chat.ConversationIDKey, rpc: ChatThreadRpc = getChatRpc()) => {
  const f = async () => {
    await rpc.joinConversation(conversationIDKey)
    // joining adds you to the participants, which nothing else recomputes
    await refreshConversationParticipants([conversationIDKey])
  }
  C.ignorePromise(f())
}

export const muteConversation = (conversationIDKey: T.Chat.ConversationIDKey, muted: boolean) => {
  setConversationStatus(
    conversationIDKey,
    muted ? T.RPCChat.ConversationStatus.muted : T.RPCChat.ConversationStatus.unfiled
  )
}

export const muteConversationPromise = async (conversationIDKey: T.Chat.ConversationIDKey, muted: boolean) =>
  setConversationStatusPromise(
    conversationIDKey,
    muted ? T.RPCChat.ConversationStatus.muted : T.RPCChat.ConversationStatus.unfiled
  )
