import * as C from '@/constants'
import * as T from '@/constants/types'
import {isPhone} from '@/constants/platform'
import {navigateToInbox, setChatRootParams} from '@/constants/router'
import logger from '@/logger'
import {getInboxConversationMeta} from '@/chat/inbox/metadata'
import {refreshConversationParticipants} from '@/chat/inbox/refresh-participants'
import {setConversationOrangeLine} from './orange-line-context'
import {getChatRpc, loadThreadMessageIDAtIndex} from './chat-rpc'

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

export const joinConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const f = async () => {
    await getChatRpc().joinConversation(conversationIDKey)
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

export const markConversationUnread = (
  conversationIDKey: T.Chat.ConversationIDKey,
  readMsgID?: T.Chat.MessageID
) => {
  const f = async () => {
    const unreadLineID = readMsgID || getInboxConversationMeta(conversationIDKey)?.maxVisibleMsgID
    if (unreadLineID) {
      setConversationOrangeLine(
        conversationIDKey,
        T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(unreadLineID))
      )
    }
    let msgID = readMsgID
    if (!msgID) {
      msgID = await loadThreadMessageIDAtIndex(conversationIDKey, 1)
    }

    if (!msgID) {
      logger.info(`marking unread messages ${conversationIDKey} failed due to no id`)
      return
    }

    logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
    await getChatRpc().markRead({conversationIDKey, forceUnread: true, msgID})
  }
  C.ignorePromise(f())
}
