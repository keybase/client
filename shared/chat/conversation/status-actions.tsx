import * as C from '@/constants'
import * as T from '@/constants/types'
import {isPhone} from '@/constants/platform'
import {navigateToInbox, setChatRootParams} from '@/constants/router'
import {enumKeys} from '@/constants/utils'
import logger from '@/logger'

const loadThreadMessageTypes = enumKeys(T.RPCChat.MessageType).reduce<Array<T.RPCChat.MessageType>>(
  (arr, key) => {
    switch (key) {
      case 'none':
      case 'edit':
      case 'delete':
      case 'attachmentuploaded':
      case 'reaction':
      case 'unfurl':
      case 'tlfname':
        break
      default: {
        const val = T.RPCChat.MessageType[key]
        if (typeof val === 'number') {
          arr.push(val)
        }
      }
    }
    return arr
  },
  []
)

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
      const pagination = {
        last: false,
        next: '',
        num: 2,
        previous: '',
      }
      try {
        await new Promise<void>(resolve => {
          let settled = false
          const done = () => {
            if (!settled) {
              settled = true
              resolve()
            }
          }
          const onGotThread = (p: string) => {
            try {
              const d = JSON.parse(p) as undefined | {messages?: Array<{valid?: {messageID?: unknown}}>}
              const m = d?.messages?.[1]?.valid?.messageID
              if (typeof m === 'number') {
                msgID = T.Chat.numberToMessageID(m)
              }
              done()
            } catch {
              done()
            }
          }
          T.RPCChat.localGetThreadNonblockRpcListener({
            incomingCallMap: {
              'chat.1.chatUi.chatThreadCached': p => onGotThread(p.thread || ''),
              'chat.1.chatUi.chatThreadFull': p => onGotThread(p.thread || ''),
            },
            params: {
              cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
              conversationID: T.Chat.keyToConversationID(conversationIDKey),
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              knownRemotes: [],
              pagination,
              pgmode: T.RPCChat.GetThreadNonblockPgMode.server,
              query: {
                disablePostProcessThread: false,
                disableResolveSupersedes: false,
                enableDeletePlaceholders: true,
                markAsRead: false,
                messageIDControl: null,
                messageTypes: loadThreadMessageTypes,
              },
              reason: T.RPCChat.GetThreadReason.general,
            },
          })
            .then(done)
            .catch(done)
        })
      } catch {}
    }

    if (!msgID) {
      logger.info(`marking unread messages ${conversationIDKey} failed due to no id`)
      return
    }

    logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
    await T.RPCChat.localMarkAsReadLocalRpcPromise({
      conversationID: T.Chat.keyToConversationID(conversationIDKey),
      forceUnread: true,
      msgID,
    })
  }
  C.ignorePromise(f())
}
