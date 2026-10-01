// Every chat service call the conversation modules make, as one interface. The production adapter
// below speaks the generated RPCs; test/fake-chat-rpc.ts is the in-memory one. Callers reach it
// through getChatRpc() at call time, so a test can swap the adapter with setChatRpc().
import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'
import {enumKeys} from '@/constants/utils'
import {isChatSessionReady} from '@/stores/config'

type WaitingKey = string | ReadonlyArray<string>

export type LoadThreadParams = {
  conversationIDKey: T.Chat.ConversationIDKey
  knownRemotes?: ReadonlyArray<string>
  messageIDControl?: T.RPCChat.MessageIDControl | null
  // streamed while the load is in flight; a thread arrives as its JSON string
  onCachedThread?: (thread: string) => void
  onFullThread?: (thread: string) => void
  onThreadStatus?: (status: T.RPCChat.UIChatThreadStatus) => void
  pagination?: T.RPCChat.UIPagination | null
  reason?: T.RPCChat.GetThreadReason
  waitingKey?: WaitingKey
}

export type PostTextParams = {
  clientPrev: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  // 0 is not exploding
  ephemeralLifetime: number
  // the text carried a stellar payment and the user backed out of it; nothing was posted
  onStellarCanceled?: () => void
  replyTo?: T.Chat.MessageID
  text: string
  tlfName: string
  unfurlSuppress?: ReadonlyArray<string>
}

export type PostAttachmentParams = {
  callerPreview?: T.RPCChat.MakePreviewRes
  clientPrev: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  // 0 is not exploding
  ephemeralLifetime: number
  filename: string
  outboxID?: T.RPCChat.OutboxID
  title: string
  tlfName: string
}

export type ChatThreadRpc = {
  // Resolves undefined without asking the service while the chat session is not ready.
  loadThread: (p: LoadThreadParams) => Promise<T.RPCChat.NonblockFetchRes | undefined>
  markRead: (p: {
    conversationIDKey: T.Chat.ConversationIDKey
    forceUnread: boolean
    msgID?: T.Chat.MessageID
  }) => Promise<void>

  postText: (p: PostTextParams) => Promise<void>
  postEdit: (p: {
    clientPrev: T.Chat.MessageID
    conversationIDKey: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
    messageOutboxID?: T.Chat.OutboxID
    text: string
    tlfName: string
  }) => Promise<void>
  postDelete: (p: {
    clientPrev?: T.Chat.MessageID
    conversationIDKey: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
    tlfName: string
  }) => Promise<void>
  // outboxID defaults to a fresh one
  postReaction: (p: {
    clientPrev: T.Chat.MessageID
    conversationIDKey: T.Chat.ConversationIDKey
    emoji: string
    messageID: T.Chat.MessageID
    outboxID?: T.RPCChat.OutboxID
    tlfName: string
  }) => Promise<void>
  postAttachment: (p: PostAttachmentParams) => Promise<void>
  cancelPost: (outboxID: T.Chat.OutboxID) => Promise<void>
  retryPost: (outboxID: T.Chat.OutboxID) => Promise<void>
  makeAudioPreview: (amps: ReadonlyArray<number>, duration: number) => Promise<T.RPCChat.MakePreviewRes>
  trackGiphySelect: (result: T.RPCChat.GiphySearchResult) => Promise<void>

  toggleCollapse: (p: {
    collapse: boolean
    conversationIDKey: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
  }) => Promise<void>
  pinMessage: (conversationIDKey: T.Chat.ConversationIDKey, messageID: T.Chat.MessageID) => Promise<void>
  resolveUnfurlPrompt: (p: {
    conversationIDKey: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
    result: T.RPCChat.UnfurlPromptResult
  }) => Promise<void>
  dismissJourneycard: (
    conversationIDKey: T.Chat.ConversationIDKey,
    cardType: T.RPCChat.JourneycardType
  ) => Promise<void>
  // an implicit-team conversation between exactly these users
  createAdhocConversation: (
    usernames: ReadonlyArray<string>,
    waitingKey?: WaitingKey
  ) => Promise<T.RPCChat.NewConversationLocalRes>

  makeUploadTempFile: (p: {
    data: Uint8Array
    filename: string
    outboxID: T.RPCChat.OutboxID
  }) => Promise<string>
  getUploadTempFile: (p: {filename: string; outboxID: T.RPCChat.OutboxID}) => Promise<string>
  cancelUploadTempFile: (outboxID: T.RPCChat.OutboxID) => Promise<void>
  // resolves the downloaded file's path
  downloadAttachment: (p: {
    conversationIDKey: T.Chat.ConversationIDKey
    downloadToCache: boolean
    messageID: T.Chat.MessageID
  }) => Promise<string>
  // the next image or video from messageID, or nothing at the end
  getNextAttachment: (p: {
    backInTime: boolean
    conversationIDKey: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
  }) => Promise<T.RPCChat.UIMessage | undefined>

  setConversationStatus: (
    conversationIDKey: T.Chat.ConversationIDKey,
    status: T.RPCChat.ConversationStatus
  ) => Promise<void>
  joinConversation: (conversationIDKey: T.Chat.ConversationIDKey) => Promise<void>

  // the per-conversation exploding lifetime lives in gregor; clearing it means the default
  setExplodingMode: (conversationIDKey: T.Chat.ConversationIDKey, seconds: number) => Promise<void>
  clearExplodingMode: (conversationIDKey: T.Chat.ConversationIDKey) => Promise<void>
}

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

const explodingModeCategory = (conversationIDKey: T.Chat.ConversationIDKey) =>
  `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`

const ephemeralDataOf = (ephemeralLifetime: number) =>
  ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}

const identifyBehavior = T.RPCGen.TLFIdentifyBehavior.chatGui

// loadThread's session rule, shared by every adapter
export const whenChatSessionReady =
  (load: ChatThreadRpc['loadThread']): ChatThreadRpc['loadThread'] =>
  async p =>
    (isChatSessionReady() ? load(p) : undefined)

const serviceChatRpc: ChatThreadRpc = {
  cancelPost: async outboxID => {
    await T.RPCChat.localCancelPostRpcPromise({outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)})
  },
  cancelUploadTempFile: async outboxID => {
    await T.RPCChat.localCancelUploadTempFileRpcPromise({outboxID})
  },
  clearExplodingMode: async conversationIDKey => {
    await T.RPCGen.gregorDismissCategoryRpcPromise({category: explodingModeCategory(conversationIDKey)})
  },
  createAdhocConversation: async (usernames, waitingKey) =>
    T.RPCChat.localNewConversationLocalRpcPromise(
      {
        identifyBehavior,
        membersType: T.RPCChat.ConversationMembersType.impteamnative,
        tlfName: [...new Set(usernames)].join(','),
        tlfVisibility: T.RPCGen.TLFVisibility.private,
        topicType: T.RPCChat.TopicType.chat,
      },
      waitingKey
    ),
  dismissJourneycard: async (conversationIDKey, cardType) => {
    await T.RPCChat.localDismissJourneycardRpcPromise({
      cardType,
      convID: T.Chat.keyToConversationID(conversationIDKey),
    })
  },
  downloadAttachment: async p => {
    const res = await T.RPCChat.localDownloadFileAttachmentLocalRpcPromise({
      conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
      downloadToCache: p.downloadToCache,
      identifyBehavior,
      messageID: p.messageID,
      preview: false,
    })
    return res.filePath
  },
  getNextAttachment: async p => {
    const res = await T.RPCChat.localGetNextAttachmentMessageLocalRpcPromise({
      assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
      backInTime: p.backInTime,
      convID: T.Chat.keyToConversationID(p.conversationIDKey),
      identifyBehavior,
      messageID: p.messageID,
    })
    return res.message ?? undefined
  },
  getUploadTempFile: async p => T.RPCChat.localGetUploadTempFileRpcPromise(p),
  joinConversation: async conversationIDKey => {
    await T.RPCChat.localJoinConversationByIDLocalRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
    })
  },
  loadThread: whenChatSessionReady(async p => {
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
    return T.RPCChat.localGetThreadNonblockRpcListener({
      incomingCallMap,
      params: {
        cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
        conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
        identifyBehavior,
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
  }),
  makeAudioPreview: async (amps, duration) => T.RPCChat.localMakeAudioPreviewRpcPromise({amps, duration}),
  makeUploadTempFile: async p => T.RPCChat.localMakeUploadTempFileRpcPromise(p),
  markRead: async p => {
    await T.RPCChat.localMarkAsReadLocalRpcPromise({
      conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
      forceUnread: p.forceUnread,
      msgID: p.msgID,
    })
  },
  pinMessage: async (conversationIDKey, messageID) => {
    await T.RPCChat.localPinMessageRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      msgID: messageID,
    })
  },
  postAttachment: async p => {
    await T.RPCChat.localPostFileAttachmentLocalNonblockRpcPromise({
      arg: {
        ...ephemeralDataOf(p.ephemeralLifetime),
        ...(p.callerPreview ? {callerPreview: p.callerPreview} : {}),
        conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
        filename: p.filename,
        identifyBehavior,
        metadata: new Uint8Array(),
        outboxID: p.outboxID,
        title: p.title,
        tlfName: p.tlfName,
        visibility: T.RPCGen.TLFVisibility.private,
      },
      clientPrev: p.clientPrev,
    })
  },
  postDelete: async p => {
    await T.RPCChat.localPostDeleteNonblockRpcPromise({
      clientPrev: p.clientPrev ?? T.Chat.numberToMessageID(0),
      conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
      identifyBehavior,
      outboxID: null,
      supersedes: p.messageID,
      tlfName: p.tlfName,
      tlfPublic: false,
    })
  },
  postEdit: async p => {
    await T.RPCChat.localPostEditNonblockRpcPromise({
      body: p.text,
      clientPrev: p.clientPrev,
      conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
      identifyBehavior,
      outboxID: Common.generateOutboxID(),
      target: {
        messageID: p.messageID,
        outboxID: p.messageOutboxID ? T.Chat.outboxIDToRpcOutboxID(p.messageOutboxID) : undefined,
      },
      tlfName: p.tlfName,
      tlfPublic: false,
    })
  },
  postReaction: async p => {
    await T.RPCChat.localPostReactionNonblockRpcPromise({
      body: p.emoji,
      clientPrev: p.clientPrev,
      conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
      identifyBehavior,
      outboxID: p.outboxID ?? Common.generateOutboxID(),
      supersedes: p.messageID,
      tlfName: p.tlfName,
      tlfPublic: false,
    })
  },
  postText: async p => {
    await T.RPCChat.localPostTextNonblockRpcListener({
      // chat never confirms a stellar payment inline: decline, and the service asks the user
      customResponseIncomingCallMap: {
        'chat.1.chatUi.chatStellarDataConfirm': (_, response) => {
          response.result(false)
        },
        'chat.1.chatUi.chatStellarDataError': (_, response) => {
          response.result(false)
        },
      },
      incomingCallMap: {
        'chat.1.chatUi.chatStellarDone': ({canceled}) => {
          if (canceled) {
            p.onStellarCanceled?.()
          }
        },
        'chat.1.chatUi.chatStellarShowConfirm': () => {},
      },
      params: {
        ...ephemeralDataOf(p.ephemeralLifetime),
        body: p.text,
        clientPrev: p.clientPrev,
        conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
        identifyBehavior,
        outboxID: undefined,
        replyTo: p.replyTo,
        tlfName: p.tlfName,
        tlfPublic: false,
        unfurlSuppress: p.unfurlSuppress ? [...p.unfurlSuppress] : [],
      },
    })
  },
  resolveUnfurlPrompt: async p => {
    await T.RPCChat.localResolveUnfurlPromptRpcPromise({
      convID: T.Chat.keyToConversationID(p.conversationIDKey),
      identifyBehavior,
      msgID: T.Chat.messageIDToNumber(p.messageID),
      result: p.result,
    })
  },
  retryPost: async outboxID => {
    await T.RPCChat.localRetryPostRpcPromise({outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)})
  },
  setConversationStatus: async (conversationIDKey, status) => {
    await T.RPCChat.localSetConversationStatusLocalRpcPromise({
      conversationID: T.Chat.keyToConversationID(conversationIDKey),
      identifyBehavior,
      status,
    })
  },
  setExplodingMode: async (conversationIDKey, seconds) => {
    await T.RPCGen.gregorUpdateCategoryRpcPromise({
      body: seconds.toString(),
      category: explodingModeCategory(conversationIDKey),
      dtime: {offset: 0, time: 0},
    })
  },
  toggleCollapse: async p => {
    await T.RPCChat.localToggleMessageCollapseRpcPromise({
      collapse: p.collapse,
      convID: T.Chat.keyToConversationID(p.conversationIDKey),
      msgID: p.messageID,
    })
  },
  trackGiphySelect: async result => {
    await T.RPCChat.localTrackGiphySelectRpcPromise({result})
  },
}

let currentChatRpc: ChatThreadRpc = serviceChatRpc

export const getChatRpc = () => currentChatRpc

// Swaps in another adapter - the in-memory fake in tests. Passing nothing restores the service one.
export const setChatRpc = (rpc?: ChatThreadRpc) => {
  currentChatRpc = rpc ?? serviceChatRpc
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

// The id of the message `index` back from the newest, from whichever thread pass lands first.
// Never rejects: a failed or empty load is undefined.
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
      getChatRpc()
        .loadThread({
          conversationIDKey,
          onCachedThread: onGotThread,
          onFullThread: onGotThread,
          pagination: {last: false, next: '', num: index + 1, previous: ''},
        })
        .then(done)
        .catch(done)
    } catch {
      done()
    }
  })
  return msgID
}
