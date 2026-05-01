import * as C from '@/constants'
import * as T from '@/constants/types'
import {isPhone} from '@/constants/platform'
import {navigateToInbox, setChatRootParams} from '@/constants/router'
import logger from '@/logger'
import {loadThreadMessageIDAtIndex, markConversationRead} from './thread-rpc'

const setConversationStatusPromise = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  status: T.RPCChat.ConversationStatus
) => {
  await T.RPCChat.localSetConversationStatusLocalRpcPromise({
    conversationID: T.Chat.keyToConversationID(conversationIDKey),
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    status,
  })
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
    await T.RPCChat.localJoinConversationByIDLocalRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
    })
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
    let msgID = readMsgID
    if (!msgID) {
      msgID = await loadThreadMessageIDAtIndex(conversationIDKey, 1)
    }

    if (!msgID) {
      logger.info(`marking unread messages ${conversationIDKey} failed due to no id`)
      return
    }

    logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
    await markConversationRead({conversationIDKey, forceUnread: true, msgID})
  }
  C.ignorePromise(f())
}
