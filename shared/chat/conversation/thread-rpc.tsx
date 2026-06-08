import * as T from '@/constants/types'
import {enumKeys} from '@/constants/utils'

type WaitingKey = string | ReadonlyArray<string>

const threadLoadMessageTypes = enumKeys(T.RPCChat.MessageType).reduce<Array<T.RPCChat.MessageType>>(
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

export const threadLoadReasonToRPCReason = (reason: string): T.RPCChat.GetThreadReason => {
  switch (reason) {
    case 'extension':
    case 'push':
      return T.RPCChat.GetThreadReason.push
    default:
      return T.RPCChat.GetThreadReason.general
  }
}

const makeThreadPagination = (num: number): T.RPCChat.UIPagination => ({
  last: false,
  next: '',
  num,
  previous: '',
})

export const loadThreadNonblock = async (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  knownRemotes?: ReadonlyArray<string>
  messageIDControl?: T.RPCChat.MessageIDControl | null
  onCachedThread?: (thread: string) => void
  onFullThread?: (thread: string) => void
  onThreadStatus?: (status: T.RPCChat.UIChatThreadStatus) => void
  pagination?: T.RPCChat.UIPagination | null
  reason?: T.RPCChat.GetThreadReason
  waitingKey?: WaitingKey
}) => {
  const incomingCallMap: T.RPCChat.IncomingCallMapType = {}
  if (p.onCachedThread) {
    incomingCallMap['chat.1.chatUi.chatThreadCached'] = params => p.onCachedThread?.(params.thread || '')
  }
  if (p.onFullThread) {
    incomingCallMap['chat.1.chatUi.chatThreadFull'] = params => p.onFullThread?.(params.thread || '')
  }
  if (p.onThreadStatus) {
    incomingCallMap['chat.1.chatUi.chatThreadStatus'] = params => p.onThreadStatus?.(params.status)
  }

  return await T.RPCChat.localGetThreadNonblockRpcListener({
    incomingCallMap,
    params: {
      cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
      conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      knownRemotes: p.knownRemotes ?? [],
      pagination: p.pagination ?? null,
      pgmode: T.RPCChat.GetThreadNonblockPgMode.server,
      query: {
        disablePostProcessThread: false,
        disableResolveSupersedes: false,
        enableDeletePlaceholders: true,
        markAsRead: false,
        messageIDControl: p.messageIDControl ?? null,
        messageTypes: threadLoadMessageTypes,
      },
      reason: p.reason ?? T.RPCChat.GetThreadReason.general,
    },
    waitingKey: p.waitingKey,
  })
}

const messageIDAtIndexFromThread = (thread: string, index: number) => {
  try {
    const parsed = JSON.parse(thread) as undefined | {messages?: Array<{valid?: {messageID?: unknown}}>}
    const messageID = parsed?.messages?.[index]?.valid?.messageID
    return typeof messageID === 'number' ? T.Chat.numberToMessageID(messageID) : undefined
  } catch {
    return undefined
  }
}

export const loadThreadMessageIDAtIndex = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  index: number
) => {
  let msgID: T.Chat.MessageID | undefined
  await new Promise<void>(resolve => {
    let settled = false
    const done = () => {
      if (!settled) {
        settled = true
        resolve()
      }
    }
    const onGotThread = (thread: string) => {
      msgID = messageIDAtIndexFromThread(thread, index)
      done()
    }
    try {
      loadThreadNonblock({
        conversationIDKey,
        onCachedThread: onGotThread,
        onFullThread: onGotThread,
        pagination: makeThreadPagination(index + 1),
      })
        .then(done)
        .catch(done)
    } catch {
      done()
    }
  })
  return msgID
}

export const markConversationRead = async (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  forceUnread: boolean
  msgID?: T.Chat.MessageID
}) => {
  return await T.RPCChat.localMarkAsReadLocalRpcPromise({
    conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
    forceUnread: p.forceUnread,
    msgID: p.msgID,
  })
}
