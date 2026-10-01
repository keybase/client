// Every chat service call the conversation modules make, as one interface. The production adapter
// below speaks the generated RPCs; test/fake-chat-rpc.ts is the in-memory one. A thread reaches it
// through its makeThreadChatRpc, other code through getChatRpc(); both look it up at call time, so
// a test can swap the adapter with setChatRpc().
import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'
import {enumKeys} from '@/constants/utils'
import {isChatSessionReady} from '@/stores/config'
import {hexToUint8Array} from '@/util/uint8array'

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
  // outboxID: the delete's own; the service picks one when it is left out
  postDelete: (p: {
    clientPrev?: T.Chat.MessageID
    conversationIDKey: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
    outboxID?: T.RPCChat.OutboxID
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

  // the service recomputes a conversation's participants only when asked
  refreshParticipants: (conversationIDKey: T.Chat.ConversationIDKey) => Promise<void>
  addToConversation: (conversationIDKey: T.Chat.ConversationIDKey, usernames: ReadonlyArray<string>) => Promise<void>
  // lets a user who reset back into the conversation
  addTeamMemberAfterReset: (conversationIDKey: T.Chat.ConversationIDKey, username: string) => Promise<void>
  // the conversation's inbox item, read without joining it
  previewConversation: (conversationIDKey: T.Chat.ConversationIDKey) => Promise<T.RPCChat.InboxUIItem>

  unpinMessage: (conversationIDKey: T.Chat.ConversationIDKey, waitingKey?: WaitingKey) => Promise<void>
  // hides the pinned message for you only
  ignorePinnedMessage: (conversationIDKey: T.Chat.ConversationIDKey) => Promise<void>

  searchForwardDestinations: (term: string) => Promise<ReadonlyArray<T.RPCChat.ConvSearchHit>>
  forwardMessage: (p: {
    conversationIDKey: T.Chat.ConversationIDKey
    destination: T.Chat.ConversationIDKey
    messageID: T.Chat.MessageID
    // an attachment's new caption
    title: string
  }) => Promise<void>

  getUnfurlPreviews: (
    conversationIDKey: T.Chat.ConversationIDKey,
    text: string
  ) => Promise<ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>>
  // each hit is streamed through onHit as it arrives
  loadGallery: (p: {
    conversationIDKey: T.Chat.ConversationIDKey
    fromMessageID?: T.Chat.MessageID
    num: number
    onHit: (message: T.RPCChat.UIMessage) => void
    viewType: T.RPCChat.GalleryItemTyp
  }) => Promise<{last: boolean}>
  // where the unread line goes for a reader who has read up to readMsgID; undefined is none
  getUnreadline: (
    conversationIDKey: T.Chat.ConversationIDKey,
    readMsgID: T.Chat.MessageID
  ) => Promise<T.Chat.MessageID | undefined>
  // every conversation in the team
  markTeamRead: (teamID: T.Teams.TeamID) => Promise<void>
  setNotificationSettings: (p: {
    channelWide: boolean
    conversationIDKey: T.Chat.ConversationIDKey
    desktop: T.Chat.NotificationsType
    mobile: T.Chat.NotificationsType
  }) => Promise<void>
  setMinWriterRole: (conversationIDKey: T.Chat.ConversationIDKey, role: T.Teams.TeamRoleType) => Promise<void>
  // every message, for everyone
  deleteHistory: (conversationIDKey: T.Chat.ConversationIDKey, tlfName: string) => Promise<void>

  setTyping: (conversationIDKey: T.Chat.ConversationIDKey, typing: boolean) => Promise<void>
  saveDraft: (p: {conversationIDKey: T.Chat.ConversationIDKey; text: string; tlfName: string}) => Promise<void>
  // the device's position, for a live location share
  updateLocation: (coord: T.Chat.Coordinate) => Promise<void>

  searchBotDestinations: (term: string) => Promise<ReadonlyArray<T.RPCChat.ConvSearchHit>>
  getBotTeamRole: (conversationIDKey: T.Chat.ConversationIDKey, username: string) => Promise<T.RPCGen.TeamRole>
  // with settings the bot is restricted to what they allow; without, it sees everything
  addBotMember: (p: {
    conversationIDKey: T.Chat.ConversationIDKey
    settings?: T.RPCGen.TeamBotSettings
    username: string
    waitingKey?: WaitingKey
  }) => Promise<void>
  getBotSettings: (conversationIDKey: T.Chat.ConversationIDKey, username: string) => Promise<T.RPCGen.TeamBotSettings>
  setBotSettings: (p: {
    conversationIDKey: T.Chat.ConversationIDKey
    settings: T.RPCGen.TeamBotSettings
    username: string
    waitingKey?: WaitingKey
  }) => Promise<void>
  removeBotMember: (p: {
    conversationIDKey: T.Chat.ConversationIDKey
    username: string
    waitingKey?: WaitingKey
  }) => Promise<void>
  // the names of the bot's public commands
  listPublicBotCommands: (username: string) => Promise<ReadonlyArray<string>>

  // hides the invitation-to-block banner of the team or conversation
  dismissBlockButtons: (teamID: T.RPCGen.TeamID) => Promise<void>
  // asks the service to show its rekey prompt for what is waiting on this device
  showPendingRekeyStatus: () => Promise<void>
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

// the composer's typing and draft updates send an invalid conversation as an empty id
const composerConversationID = (conversationIDKey: T.Chat.ConversationIDKey) =>
  T.Chat.isValidConversationIDKey(conversationIDKey)
    ? T.Chat.keyToConversationID(conversationIDKey)
    : new Uint8Array(0)

const notificationSettings = (
  desktop: T.Chat.NotificationsType,
  mobile: T.Chat.NotificationsType
): Array<T.RPCChat.AppNotificationSettingLocal> => [
  {
    deviceType: T.RPCGen.DeviceType.desktop,
    enabled: desktop === 'onWhenAtMentioned',
    kind: T.RPCChat.NotificationKind.atmention,
  },
  {
    deviceType: T.RPCGen.DeviceType.desktop,
    enabled: desktop === 'onAnyActivity',
    kind: T.RPCChat.NotificationKind.generic,
  },
  {
    deviceType: T.RPCGen.DeviceType.mobile,
    enabled: mobile === 'onWhenAtMentioned',
    kind: T.RPCChat.NotificationKind.atmention,
  },
  {
    deviceType: T.RPCGen.DeviceType.mobile,
    enabled: mobile === 'onAnyActivity',
    kind: T.RPCChat.NotificationKind.generic,
  },
]

// loadThread's session rule, shared by every adapter
export const whenChatSessionReady =
  (load: ChatThreadRpc['loadThread']): ChatThreadRpc['loadThread'] =>
  async p =>
    (isChatSessionReady() ? load(p) : undefined)

const serviceChatRpc: ChatThreadRpc = {
  addBotMember: async p => {
    await T.RPCChat.localAddBotMemberRpcPromise(
      {
        botSettings: p.settings ?? null,
        convID: T.Chat.keyToConversationID(p.conversationIDKey),
        role: p.settings ? T.RPCGen.TeamRole.restrictedbot : T.RPCGen.TeamRole.bot,
        username: p.username,
      },
      p.waitingKey
    )
  },
  addTeamMemberAfterReset: async (conversationIDKey, username) => {
    await T.RPCChat.localAddTeamMemberAfterResetRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      username,
    })
  },
  addToConversation: async (conversationIDKey, usernames) => {
    await T.RPCChat.localBulkAddToConvRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      usernames: [...usernames],
    })
  },
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
  deleteHistory: async (conversationIDKey, tlfName) => {
    await T.RPCChat.localPostDeleteHistoryByAgeRpcPromise({
      age: 0,
      conversationID: T.Chat.keyToConversationID(conversationIDKey),
      identifyBehavior,
      tlfName,
      tlfPublic: false,
    })
  },
  dismissBlockButtons: async teamID => {
    await T.RPCGen.userDismissBlockButtonsRpcPromise({tlfID: teamID})
  },
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
  forwardMessage: async p => {
    await T.RPCChat.localForwardMessageNonblockRpcPromise({
      dstConvID: T.Chat.keyToConversationID(p.destination),
      identifyBehavior,
      msgID: p.messageID,
      srcConvID: T.Chat.keyToConversationID(p.conversationIDKey),
      title: p.title,
    })
  },
  getBotSettings: async (conversationIDKey, username) =>
    T.RPCChat.localGetBotMemberSettingsRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      username,
    }),
  getBotTeamRole: async (conversationIDKey, username) =>
    T.RPCChat.localGetTeamRoleInConversationRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      username,
    }),
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
  getUnfurlPreviews: async (conversationIDKey, text) =>
    (await T.RPCChat.localUnfurlPreviewLocalRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      text,
    })) ?? [],
  getUnreadline: async (conversationIDKey, readMsgID) => {
    const res = await T.RPCChat.localGetUnreadlineRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      identifyBehavior,
      readMsgID,
    })
    return res.unreadlineID ? T.Chat.numberToMessageID(res.unreadlineID) : undefined
  },
  getUploadTempFile: async p => T.RPCChat.localGetUploadTempFileRpcPromise(p),
  ignorePinnedMessage: async conversationIDKey => {
    await T.RPCChat.localIgnorePinnedMessageRpcPromise({convID: T.Chat.keyToConversationID(conversationIDKey)})
  },
  joinConversation: async conversationIDKey => {
    await T.RPCChat.localJoinConversationByIDLocalRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
    })
  },
  listPublicBotCommands: async username => {
    const res = await T.RPCChat.localListPublicBotCommandsLocalRpcPromise({username})
    return (res.commands ?? []).map(command => command.name)
  },
  loadGallery: async p => {
    const res = await T.RPCChat.localLoadGalleryRpcListener({
      incomingCallMap: {
        'chat.1.chatUi.chatLoadGalleryHit': hit => p.onHit(hit.message),
      },
      params: {
        convID: T.Chat.keyToConversationID(p.conversationIDKey),
        fromMsgID: p.fromMessageID,
        num: p.num,
        typ: p.viewType,
      },
    })
    return {last: !!res.last}
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
  markTeamRead: async teamID => {
    await T.RPCChat.localMarkTLFAsReadLocalRpcPromise({tlfID: hexToUint8Array(T.Teams.teamIDToString(teamID))})
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
      outboxID: p.outboxID ?? null,
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
  previewConversation: async conversationIDKey => {
    const res = await T.RPCChat.localPreviewConversationByIDLocalRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
    })
    return res.conv
  },
  refreshParticipants: async conversationIDKey => {
    await T.RPCChat.localRefreshParticipantsRpcPromise({convID: T.Chat.keyToConversationID(conversationIDKey)})
  },
  removeBotMember: async p => {
    await T.RPCChat.localRemoveBotMemberRpcPromise(
      {convID: T.Chat.keyToConversationID(p.conversationIDKey), username: p.username},
      p.waitingKey
    )
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
  saveDraft: async p => {
    await T.RPCChat.localUpdateUnsentTextRpcPromise({
      conversationID: composerConversationID(p.conversationIDKey),
      text: p.text,
      tlfName: p.tlfName,
    })
  },
  searchBotDestinations: async term => (await T.RPCChat.localAddBotConvSearchRpcPromise({term})) ?? [],
  searchForwardDestinations: async term =>
    (await T.RPCChat.localForwardMessageConvSearchRpcPromise({term})) ?? [],
  setBotSettings: async p => {
    await T.RPCChat.localSetBotMemberSettingsRpcPromise(
      {
        botSettings: p.settings,
        convID: T.Chat.keyToConversationID(p.conversationIDKey),
        username: p.username,
      },
      p.waitingKey
    )
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
  setMinWriterRole: async (conversationIDKey, role) => {
    await T.RPCChat.localSetConvMinWriterRoleLocalRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      role: T.RPCGen.TeamRole[role],
    })
  },
  setNotificationSettings: async p => {
    await T.RPCChat.localSetAppNotificationSettingsLocalRpcPromise({
      channelWide: p.channelWide,
      convID: T.Chat.keyToConversationID(p.conversationIDKey),
      settings: notificationSettings(p.desktop, p.mobile),
    })
  },
  setTyping: async (conversationIDKey, typing) => {
    await T.RPCChat.localUpdateTypingRpcPromise({
      conversationID: composerConversationID(conversationIDKey),
      typing,
    })
  },
  showPendingRekeyStatus: async () => {
    await T.RPCGen.rekeyShowPendingRekeyStatusRpcPromise()
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
  unpinMessage: async (conversationIDKey, waitingKey) => {
    await T.RPCChat.localUnpinMessageRpcPromise({convID: T.Chat.keyToConversationID(conversationIDKey)}, waitingKey)
  },
  updateLocation: async ({accuracy, lat, lon}) => {
    await T.RPCChat.localLocationUpdateRpcPromise({coord: {accuracy, lat, lon}})
  },
}

let currentChatRpc: ChatThreadRpc = serviceChatRpc

export const getChatRpc = () => currentChatRpc

// What a thread asks of the service: its screens, its store and the load pipeline running for it.
// Each call reaches the current adapter until the thread retires; from then on a call asks nothing
// and never settles. So code after its await, a finally included, must be nothing that has to run
// on a retired thread. A call already in flight when the thread retires settles as usual, and its
// continuation checks isRetired() where it acts outside the thread's store.
export const makeThreadChatRpc = (isRetired: () => boolean): ChatThreadRpc =>
  Object.fromEntries(
    (Object.keys(serviceChatRpc) as Array<keyof ChatThreadRpc>).map(key => [
      key,
      (...args: ReadonlyArray<unknown>) =>
        isRetired()
          ? new Promise(() => {})
          : (currentChatRpc[key] as (...args: ReadonlyArray<unknown>) => unknown)(...args),
    ])
  ) as unknown as ChatThreadRpc

// Swaps in another adapter - the in-memory fake in tests. Passing nothing restores the service one.
export const setChatRpc = (rpc?: ChatThreadRpc) => {
  currentChatRpc = rpc ?? serviceChatRpc
}
