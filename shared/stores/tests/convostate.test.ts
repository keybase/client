/// <reference types="jest" />
import * as Common from '../../constants/chat/common'
import * as Meta from '../../constants/chat/meta'
import * as Message from '../../constants/chat/message'
import * as T from '../../constants/types'
import HiddenString from '../../util/hidden-string'
import {resetAllStores} from '../../util/zustand'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {
  createConvoStoreForTesting,
  type ConvoState,
  getConvoState,
  handleConvoEngineIncoming,
  syncBadgeState,
} from '../convostate'
import {queueInboxRowUpdate} from '../inbox-rows'

jest.mock('../inbox-rows', () => ({
  queueInboxRowUpdate: jest.fn(),
}))

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const ordinal = T.Chat.numberToOrdinal(10)
const msgID = T.Chat.numberToMessageID(101)
const outboxID = T.Chat.stringToOutboxID('outbox-1')

const makeReaction = (username: string, timestamp: number): T.Chat.ReactionDesc => ({
  decorated: ':+1:',
  users: [{timestamp, username}],
})

const makeRpcOutboxID = (label: string): T.RPCChat.OutboxID =>
  new TextEncoder().encode(label)

const makeTextMessage = (override?: Omit<Partial<T.Chat.MessageText>, 'text'> & {text?: string}) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: msgID,
    ordinal,
    outboxID,
    timestamp: 100,
    ...override,
    text: new HiddenString(override?.text ?? 'hello'),
  })

const makePendingTextMessage = (pendingOrdinal: T.Chat.Ordinal, pendingOutboxID: T.Chat.OutboxID, text: string) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    ordinal: pendingOrdinal,
    outboxID: pendingOutboxID,
    submitState: 'pending',
    text: new HiddenString(text),
    timestamp: 50,
  })

const makeValidTextUIMessage = (
  serverMsgID: T.Chat.MessageID,
  text: string,
  options?: {
    author?: string
    outboxID?: T.Chat.OutboxID
    timestamp?: number
  }
): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: {
    atMentions: null,
    bodySummary: text,
    botUsername: '',
    channelMention: T.RPCChat.ChannelMention.none,
    channelNameMentions: null,
    ctime: options?.timestamp ?? 200,
    decoratedTextBody: null,
    etime: 0,
    explodedBy: null,
    hasPairwiseMacs: false,
    isCollapsed: false,
    isDeleteable: true,
    isEditable: true,
    isEphemeral: false,
    isEphemeralExpired: false,
    messageBody: {
      messageType: T.RPCChat.MessageType.text,
      text: {
        body: text,
        payments: null,
        replyTo: null,
        replyToUID: null,
        teamMentions: null,
        userMentions: null,
      },
    },
    messageID: T.Chat.messageIDToNumber(serverMsgID),
    outboxID: T.Chat.outboxIDToString(options?.outboxID ?? T.Chat.stringToOutboxID('')),
    paymentInfos: null,
    pinnedMessageID: null,
    reactions: {},
    replyTo: null,
    requestInfo: null,
    senderDeviceID: new Uint8Array([1]),
    senderDeviceName: `${options?.author ?? 'alice'}-device`,
    senderDeviceRevokedAt: null,
    senderDeviceType: 'desktop',
    senderUID: new Uint8Array([2]),
    senderUsername: options?.author ?? 'alice',
    superseded: false,
    unfurls: null,
  },
})

const makePlaceholderUIMessage = (messageID: T.Chat.MessageID, hidden = false): T.RPCChat.UIMessage =>
  ({
    placeholder: {
      hidden,
      messageID: T.Chat.messageIDToNumber(messageID),
    },
    state: T.RPCChat.MessageUnboxedState.placeholder,
  }) as T.RPCChat.UIMessage

const makeAttachmentMessage = (override?: Partial<T.Chat.MessageAttachment>) =>
  Message.makeMessageAttachment({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(201),
    ordinal: T.Chat.numberToOrdinal(201),
    outboxID: T.Chat.stringToOutboxID('attachment-outbox'),
    timestamp: 100,
    title: 'attachment title',
    ...override,
  })

const makePaymentInfo = (override?: Partial<T.Chat.ChatPaymentInfo>): T.Chat.ChatPaymentInfo => ({
  accountID: 'account-id',
  amountDescription: '1 XLM',
  delta: 'none',
  fromUsername: 'alice',
  issuerDescription: 'Lumens',
  note: new HiddenString('payment note'),
  paymentID: 'payment-1',
  showCancel: false,
  sourceAmount: '1',
  sourceAsset: {
    code: 'XLM',
    depositButtonText: '',
    infoUrl: '',
    infoUrlText: '',
    issuerAccountID: 'issuer-account-id',
    issuerName: 'Lumens',
    issuerVerifiedDomain: '',
    showDepositButton: false,
    showWithdrawButton: false,
    withdrawButtonText: '',
  },
  status: 'completed',
  statusDescription: 'Completed',
  statusDetail: '',
  toUsername: 'bob',
  type: 'paymentInfo',
  worth: '$1.00',
  worthAtSendTime: '$1.00',
  ...override,
})

const makeCoinFlipStatus = (
  override?: Partial<T.RPCChat.UICoinFlipStatus>
): T.RPCChat.UICoinFlipStatus => ({
  commitmentVisualization: '',
  convID,
  errorInfo: null,
  gameID: 'flip-game',
  participants: [],
  phase: T.RPCChat.UICoinFlipPhase.commitment,
  progressText: 'Collecting commitments',
  resultInfo: null,
  resultText: '',
  revealVisualization: '',
  ...override,
})

const makeMeta = (override?: Partial<T.Chat.ConversationMeta>) => ({
  ...Meta.makeConversationMeta(),
  conversationIDKey: convID,
  maxVisibleMsgID: msgID,
  readMsgID: T.Chat.numberToMessageID(0),
  ...override,
})

test('getReactionOrder sorts emojis by earliest reaction timestamp', () => {
  const reactions = new Map([
    [':fire:', makeReaction('carol', 70)],
    [
      ':+1:',
      {
        decorated: ':+1:',
        users: [
          {timestamp: 50, username: 'alice'},
          {timestamp: 30, username: 'bob'},
        ],
      },
    ],
    [':wave:', makeReaction('bob', 60)],
    [':eyes:', makeReaction('dave', 40)],
  ])

  expect(Message.getReactionOrder(reactions)).toEqual([':+1:', ':eyes:', ':wave:', ':fire:'])
})

const applyState = (
  store: {getState: () => any; setState: (state: any) => void},
  partial: Partial<ConvoState> & {messageIDToOrdinal?: ReadonlyMap<T.Chat.MessageID, T.Chat.Ordinal>}
) => {
  const current = store.getState()
  store.setState({
    ...current,
    ...partial,
    dispatch: current.dispatch,
    getConvID: current.getConvID,
    isCaughtUp: current.isCaughtUp,
    isMetaGood: current.isMetaGood,
  })
}

const createStore = () => createConvoStoreForTesting(convID)

type LoadMoreMessagesMock = (
  p: Parameters<ConvoState['dispatch']['loadMoreMessages']>[0]
) => undefined

const makeLoadMoreMessagesMock = () =>
  Object.assign(
    jest.fn<ReturnType<LoadMoreMessagesMock>, Parameters<LoadMoreMessagesMock>>(),
    {
      cancel: () => {},
      flush: () => undefined,
    }
  )

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const seedStore = (
  messages: ReadonlyArray<T.Chat.Message>,
  extra?: Partial<ConvoState> & {
    messageIDToOrdinal?: ReadonlyMap<T.Chat.MessageID, T.Chat.Ordinal>
    pendingOutboxToOrdinal?: ReadonlyMap<T.Chat.OutboxID, T.Chat.Ordinal>
  }
) => {
  const store = createStore()
  const sortedMessages = [...messages].sort((a, b) => a.ordinal - b.ordinal)
  const messageMap = new Map(sortedMessages.map(message => [message.ordinal, message]))
  const messageOrdinals = sortedMessages
    .filter(message => message.conversationMessage !== false && message.type !== 'deleted')
    .map(message => message.ordinal)
  const messageTypeMap = new Map<T.Chat.Ordinal, T.Chat.RenderMessageType>()
  const messageIDToOrdinal = new Map<T.Chat.MessageID, T.Chat.Ordinal>()
  const pendingOutboxToOrdinal = new Map<T.Chat.OutboxID, T.Chat.Ordinal>()
  sortedMessages.forEach(message => {
    if (message.type !== 'text') {
      messageTypeMap.set(message.ordinal, Message.getMessageRenderType(message))
    }
    if (message.id) {
      messageIDToOrdinal.set(message.id, message.ordinal)
    }
    if (message.outboxID) {
      pendingOutboxToOrdinal.set(message.outboxID, message.ordinal)
    }
  })
  applyState(store, {
    loaded: true,
    messageIDToOrdinal,
    messageMap,
    messageOrdinals,
    messageTypeMap,
    meta: makeMeta(),
    pendingOutboxToOrdinal,
    ...extra,
  })
  return store
}

const seedStoreWithAnchoredMessage = () => {
  const store = createStore()
  const message = makeTextMessage()
  const baseState: Partial<ConvoState> = {
    loaded: true,
    messageMap: new Map([[ordinal, message]]),
    messageOrdinals: [ordinal],
    messageTypeMap: new Map(),
    meta: makeMeta(),
    pendingOutboxToOrdinal: new Map([[outboxID, ordinal]]),
  }
  applyState(store, {
    ...baseState,
    messageIDToOrdinal: new Map([[msgID, ordinal]]),
  })
  return store
}

test('testing store starts with initial state and helper selectors', () => {
  const store = createStore()
  const state = store.getState()
  expect(state.id).toBe(convID)
  expect(state.loaded).toBe(false)
  expect(state.messageMap.size).toBe(0)
  expect(state.messageOrdinals).toBeUndefined()
  expect(state.getConvID()).toEqual(T.Chat.keyToConversationID(convID))
  expect(state.isCaughtUp()).toBe(true)
  expect(state.isMetaGood()).toBe(false)
})

test('paymentInfoReceived stores payment info by message ID and payment ID', () => {
  const store = createStore()
  const paymentInfo = makePaymentInfo()

  store.getState().dispatch.paymentInfoReceived(msgID, paymentInfo)

  const state = store.getState()
  expect(state.accountsInfoMap.get(msgID)).toEqual(paymentInfo)
  expect(state.paymentStatusMap.get(paymentInfo.paymentID)).toEqual(paymentInfo)
})

test('updateCoinFlipStatus stores coin flip status by game ID in the convo store', () => {
  const store = createStore()
  const status = makeCoinFlipStatus()

  store.getState().dispatch.updateCoinFlipStatus(status)

  expect(store.getState().flipStatusMap.get(status.gameID)).toEqual(status)
})

test('coin flip status batches are grouped by conversation', () => {
  const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([9, 8, 7, 6]))
  const first = makeCoinFlipStatus({gameID: 'flip-1', progressText: 'first'})
  const replacement = makeCoinFlipStatus({gameID: 'flip-1', progressText: 'updated'})
  const second = makeCoinFlipStatus({convID: otherConvID, gameID: 'flip-2'})

  getConvoState(convID).dispatch.updateCoinFlipStatuses([first])
  handleConvoEngineIncoming({
    payload: {params: {statuses: [replacement, second]}},
    type: 'chat.1.chatUi.chatCoinFlipStatus',
  } as never)

  expect(getConvoState(convID).flipStatusMap.get('flip-1')).toEqual(replacement)
  expect(getConvoState(otherConvID).flipStatusMap.get('flip-2')).toEqual(second)
})

test('onMessagesUpdated adds messages and updates message indexes', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)

  const store = createStore()
  const firstMsgID = T.Chat.numberToMessageID(301)
  const secondMsgID = T.Chat.numberToMessageID(302)

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [
      makeValidTextUIMessage(firstMsgID, 'first', {author: 'bob', timestamp: 100}),
      makeValidTextUIMessage(secondMsgID, 'second', {author: 'bob', timestamp: 101}),
    ],
  })

  expect(store.getState().messageOrdinals).toEqual([
    T.Chat.numberToOrdinal(301),
    T.Chat.numberToOrdinal(302),
  ])
  expect(store.getState().messageIDToOrdinal.get(firstMsgID)).toBe(T.Chat.numberToOrdinal(301))
  expect(store.getState().messageTypeMap.size).toBe(0)
})

test('onMessagesUpdated ignores unopened background conversations', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(false)

  const store = createStore()
  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makeValidTextUIMessage(T.Chat.numberToMessageID(401), 'background update')],
  })

  expect(store.getState().messageOrdinals).toBeUndefined()
  expect(store.getState().messageMap.size).toBe(0)
})

test('onMessagesUpdated still applies to unopened active conversations', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)

  const store = createStore()
  const msgID = T.Chat.numberToMessageID(402)
  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makeValidTextUIMessage(msgID, 'active update')],
  })

  expect(store.getState().messageOrdinals).toEqual([T.Chat.numberToOrdinal(402)])
  expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(402))?.id).toBe(msgID)
})

test('galleryMessagesLoaded injects gallery-only messages without marking read', () => {
  const threadMessage = makeTextMessage({
    id: T.Chat.numberToMessageID(301),
    ordinal: T.Chat.numberToOrdinal(301),
  })
  const galleryMessage = makeAttachmentMessage({
    conversationMessage: false,
    id: T.Chat.numberToMessageID(501),
    ordinal: T.Chat.numberToOrdinal(501),
  })
  const store = seedStore([threadMessage])
  const markThreadAsRead = jest.fn<
    ReturnType<ConvoState['dispatch']['markThreadAsRead']>,
    Parameters<ConvoState['dispatch']['markThreadAsRead']>
  >()
  const current = store.getState()
  store.setState({
    ...current,
    dispatch: {...current.dispatch, markThreadAsRead},
  })

  store.getState().dispatch.galleryMessagesLoaded([galleryMessage])

  expect(store.getState().messageMap.get(galleryMessage.ordinal)).toEqual(galleryMessage)
  expect(store.getState().messageOrdinals).toEqual([threadMessage.ordinal])
  expect(store.getState().messageIDToOrdinal.get(galleryMessage.id)).toBe(galleryMessage.ordinal)
  expect(store.getState().messageTypeMap.get(galleryMessage.ordinal)).toBe(
    Message.getMessageRenderType(galleryMessage)
  )
  expect(markThreadAsRead).not.toHaveBeenCalled()
})

test('attachment download progress and completion update message transfer state', () => {
  const attachment = makeAttachmentMessage({
    transferErrMsg: 'old error',
    transferProgress: 0,
  })
  const store = seedStore([attachment])

  store.getState().dispatch.onEngineIncoming({
    payload: {
      params: {
        bytesComplete: 25,
        bytesTotal: 100,
        convID: T.Chat.keyToConversationID(convID),
        msgID: T.Chat.messageIDToNumber(attachment.id),
      },
    },
    type: 'chat.1.NotifyChat.ChatAttachmentDownloadProgress',
  } as never)

  const downloading = store.getState().messageMap.get(attachment.ordinal)
  expect(downloading?.type === 'attachment' ? downloading.transferErrMsg : undefined).toBeUndefined()
  expect(downloading?.type === 'attachment' ? downloading.transferProgress : undefined).toBe(0.25)
  expect(downloading?.type === 'attachment' ? downloading.transferState : undefined).toBe('downloading')

  store.getState().dispatch.onEngineIncoming({
    payload: {
      params: {
        convID: T.Chat.keyToConversationID(convID),
        msgID: T.Chat.messageIDToNumber(attachment.id),
      },
    },
    type: 'chat.1.NotifyChat.ChatAttachmentDownloadComplete',
  } as never)

  const complete = store.getState().messageMap.get(attachment.ordinal)
  expect(complete?.type === 'attachment' ? complete.transferProgress : undefined).toBe(0)
  expect(complete?.type === 'attachment' ? complete.transferState : undefined).toBeUndefined()
})

test('attachment transfer events ignore non-actionable rows', () => {
  const downloaded = makeAttachmentMessage({
    downloadPath: '/tmp/downloaded.png',
    id: T.Chat.numberToMessageID(701),
    ordinal: T.Chat.numberToOrdinal(701),
    transferProgress: 0.5,
  })
  const completed = makeAttachmentMessage({
    id: T.Chat.numberToMessageID(702),
    ordinal: T.Chat.numberToOrdinal(702),
    transferProgress: 1,
  })
  const text = makeTextMessage({
    id: T.Chat.numberToMessageID(703),
    ordinal: T.Chat.numberToOrdinal(703),
  })
  const store = seedStore([downloaded, completed, text])

  ;[downloaded, completed, text].forEach(message => {
    store.getState().dispatch.onEngineIncoming({
      payload: {
        params: {
          bytesComplete: 75,
          bytesTotal: 100,
          convID: T.Chat.keyToConversationID(convID),
          msgID: T.Chat.messageIDToNumber(message.id),
        },
      },
      type: 'chat.1.NotifyChat.ChatAttachmentDownloadProgress',
    } as never)
  })
  store.getState().dispatch.onEngineIncoming({
    payload: {
      params: {
        bytesComplete: 75,
        bytesTotal: 100,
        convID: T.Chat.keyToConversationID(convID),
        msgID: 9999,
      },
    },
    type: 'chat.1.NotifyChat.ChatAttachmentDownloadProgress',
  } as never)

  const downloadedAfter = store.getState().messageMap.get(downloaded.ordinal)
  const completedAfter = store.getState().messageMap.get(completed.ordinal)
  const textAfter = store.getState().messageMap.get(text.ordinal)
  expect(downloadedAfter?.type === 'attachment' ? downloadedAfter.transferProgress : undefined).toBe(0.5)
  expect(completedAfter?.type === 'attachment' ? completedAfter.transferProgress : undefined).toBe(1)
  expect(textAfter?.type).toBe('text')
})

test('attachment upload progress updates pending outbox-backed rows', () => {
  const uploadRpcOutboxID = makeRpcOutboxID('upload-outbox')
  const uploadOutboxID = T.Chat.rpcOutboxIDToOutboxID(uploadRpcOutboxID)
  const attachment = makeAttachmentMessage({
    outboxID: uploadOutboxID,
    transferProgress: 0,
  })
  const store = seedStore([attachment])

  store.getState().dispatch.onEngineIncoming({
    payload: {
      params: {
        bytesComplete: 30,
        bytesTotal: 60,
        convID: T.Chat.keyToConversationID(convID),
        outboxID: uploadRpcOutboxID,
        uid: 'uid',
      },
    },
    type: 'chat.1.NotifyChat.ChatAttachmentUploadProgress',
  } as never)

  const message = store.getState().messageMap.get(attachment.ordinal)
  expect(message?.type === 'attachment' ? message.transferProgress : undefined).toBe(0.5)
  expect(message?.type === 'attachment' ? message.transferState : undefined).toBe('uploading')
})

test('message updates merge into the existing message row', () => {
  const firstOrdinal = T.Chat.numberToOrdinal(301)
  const secondOrdinal = T.Chat.numberToOrdinal(302)
  const firstMsgID = T.Chat.numberToMessageID(301)
  const store = seedStore([
    makeTextMessage({
      author: 'bob',
      id: firstMsgID,
      ordinal: firstOrdinal,
      outboxID: T.Chat.stringToOutboxID('first'),
      timestamp: 100,
    }),
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(302),
      ordinal: secondOrdinal,
      outboxID: T.Chat.stringToOutboxID('second'),
      timestamp: 101,
    }),
  ])

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makeValidTextUIMessage(firstMsgID, 'edited first', {author: 'alice', timestamp: 100})],
  })

  const firstMessage = store.getState().messageMap.get(firstOrdinal)
  expect(firstMessage?.author).toBe('alice')
  expect(firstMessage?.type === 'text' ? firstMessage.text.stringValue() : undefined).toBe('edited first')
  expect(store.getState().messageMap.has(secondOrdinal)).toBe(true)
})

test('message updates clear stale optional row metadata', () => {
  const replyTo = makeTextMessage({
    id: T.Chat.numberToMessageID(299),
    ordinal: T.Chat.numberToOrdinal(299),
    text: 'old reply',
  })
  const store = seedStore([
    makeTextMessage({
      decoratedText: new HiddenString('decorated old text'),
      flipGameID: 'old-flip',
      reactions: new Map([[':+1:', makeReaction('bob', 5)]]),
      replyTo,
      text: 'old text',
      unfurls: new Map([['https://keybase.io', {} as T.RPCChat.UIMessageUnfurlInfo]]),
    }),
  ])

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makeValidTextUIMessage(msgID, 'fresh text')],
  })

  const message = store.getState().messageMap.get(ordinal)
  expect(message?.type === 'text' ? message.text.stringValue() : undefined).toBe('fresh text')
  expect(message?.reactions).toBeUndefined()
  expect(message?.type === 'text' ? message.decoratedText : undefined).toBeUndefined()
  expect(message?.type === 'text' ? message.flipGameID : undefined).toBeUndefined()
  expect(message?.type === 'text' ? message.replyTo : undefined).toBeUndefined()
  expect(message?.type === 'text' ? message.unfurls : undefined).toBeUndefined()
})

test('reaction updates preserve outbox-anchored row identity', () => {
  const store = seedStoreWithAnchoredMessage()
  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])
  store.getState().dispatch.updateReactions([{reactions, targetMsgID: msgID}])
  expect(Message.getReactionOrder(store.getState().messageMap.get(ordinal)?.reactions ?? new Map())[0]).toBe(':+1:')
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
})

test('reaction updates keep existing emoji order and sort new emojis by first timestamp', () => {
  const store = seedStore([
    makeTextMessage({
      reactions: new Map([
        [':+1:', makeReaction('alice', 50)],
        [':wave:', makeReaction('bob', 60)],
      ]),
    }),
  ])
  const reactions = new Map([
    [':fire:', makeReaction('carol', 70)],
    [':+1:', makeReaction('alice', 30)],
    [':wave:', makeReaction('bob', 80)],
    [':eyes:', makeReaction('dave', 40)],
  ])

  store.getState().dispatch.updateReactions([{reactions, targetMsgID: msgID}])

  const message = store.getState().messageMap.get(ordinal)
  expect(Message.isMessageWithReactions(message!)).toBe(true)
  if (message && Message.isMessageWithReactions(message)) {
    expect(Message.getReactionOrder(message.reactions ?? new Map())).toEqual([':+1:', ':eyes:', ':fire:', ':wave:'])
    expect([...(message.reactions?.keys() ?? [])]).toEqual([':+1:', ':wave:', ':eyes:', ':fire:'])
  }
})

test('reaction updates clear message reactions when the server sends none', () => {
  const store = seedStore([makeTextMessage({reactions: new Map([[':+1:', makeReaction('bob', 5)]])})])
  store.getState().dispatch.updateReactions([{targetMsgID: msgID}])
  const message = store.getState().messageMap.get(ordinal)
  expect(message && Message.isMessageWithReactions(message) ? message.reactions : undefined).toBeUndefined()
})

test('reaction updates ignore deleted and placeholder rows', () => {
  const deletedMsgID = T.Chat.numberToMessageID(401)
  const placeholderMsgID = T.Chat.numberToMessageID(402)
  const store = seedStore([
    Message.makeMessageDeleted({
      author: 'alice',
      conversationIDKey: convID,
      id: deletedMsgID,
      ordinal: T.Chat.numberToOrdinal(401),
    }),
    Message.makeMessagePlaceholder({
      conversationIDKey: convID,
      id: placeholderMsgID,
      ordinal: T.Chat.numberToOrdinal(402),
    }),
  ])
  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])

  store.getState().dispatch.updateReactions([
    {reactions, targetMsgID: deletedMsgID},
    {reactions, targetMsgID: placeholderMsgID},
  ])

  expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(401))?.type).toBe('deleted')
  expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(402))?.type).toBe('placeholder')
})

test('message deletion removes the row but preserves the outbox anchor', () => {
  const store = seedStoreWithAnchoredMessage()
  store.getState().dispatch.messagesWereDeleted({messageIDs: [msgID]})
  expect(store.getState().messageMap.has(ordinal)).toBe(false)
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
  expect(store.getState().messageIDToOrdinal.has(msgID)).toBe(false)
})

test('message deletion removes the ordinal and keeps the next row', () => {
  const firstOrdinal = T.Chat.numberToOrdinal(401)
  const secondOrdinal = T.Chat.numberToOrdinal(402)
  const store = seedStore([
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(401),
      ordinal: firstOrdinal,
      outboxID: T.Chat.stringToOutboxID('first-delete'),
      timestamp: 100,
    }),
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(402),
      ordinal: secondOrdinal,
      outboxID: T.Chat.stringToOutboxID('second-delete'),
      timestamp: 101,
    }),
  ])

  store.getState().dispatch.messagesWereDeleted({ordinals: [firstOrdinal]})

  expect(store.getState().messageOrdinals).toEqual([secondOrdinal])
  expect(store.getState().messageMap.has(firstOrdinal)).toBe(false)
  expect(store.getState().messageMap.get(secondOrdinal)?.author).toBe('bob')
})

test('message deletion clears attachment render type indexes', () => {
  const attachment = makeAttachmentMessage()
  const store = seedStore([attachment])

  expect(store.getState().messageTypeMap.has(attachment.ordinal)).toBe(true)

  store.getState().dispatch.messagesWereDeleted({messageIDs: [attachment.id]})

  expect(store.getState().messageMap.has(attachment.ordinal)).toBe(false)
  expect(store.getState().messageOrdinals).toEqual([])
  expect(store.getState().messageIDToOrdinal.has(attachment.id)).toBe(false)
  expect(store.getState().messageTypeMap.has(attachment.ordinal)).toBe(false)
})

test('message deletion up to a message ID honors deletable message types', () => {
  const earlyText = makeTextMessage({
    id: T.Chat.numberToMessageID(501),
    ordinal: T.Chat.numberToOrdinal(501),
    outboxID: T.Chat.stringToOutboxID('early-text'),
  })
  const attachment = makeAttachmentMessage({
    id: T.Chat.numberToMessageID(502),
    ordinal: T.Chat.numberToOrdinal(502),
    outboxID: T.Chat.stringToOutboxID('early-attachment'),
  })
  const laterText = makeTextMessage({
    id: T.Chat.numberToMessageID(503),
    ordinal: T.Chat.numberToOrdinal(503),
    outboxID: T.Chat.stringToOutboxID('later-text'),
  })
  const store = seedStore([earlyText, attachment, laterText])

  store.getState().dispatch.messagesWereDeleted({
    deletableMessageTypes: new Set<T.Chat.MessageType>(['text']),
    upToMessageID: T.Chat.numberToMessageID(503),
  })

  expect(store.getState().messageMap.has(T.Chat.numberToOrdinal(501))).toBe(false)
  expect(store.getState().messageMap.has(T.Chat.numberToOrdinal(502))).toBe(true)
  expect(store.getState().messageMap.has(T.Chat.numberToOrdinal(503))).toBe(true)
  expect(store.getState().messageOrdinals).toEqual([T.Chat.numberToOrdinal(502), T.Chat.numberToOrdinal(503)])
})

test('explode-now clears text content and transient metadata in place', () => {
  const store = seedStore([
    makeTextMessage({
      flipGameID: 'flip-game',
      mentionsAt: new Set(['bob']),
      reactions: new Map([[':+1:', makeReaction('bob', 5)]]),
      unfurls: new Map([['https://keybase.io', {} as T.RPCChat.UIMessageUnfurlInfo]]),
    }),
  ])
  store.getState().dispatch.messagesExploded([msgID], 'bob')
  const state = store.getState()
  const message = state.messageMap.get(ordinal)
  expect(message?.type).toBe('text')
  expect(message?.type === 'text' ? message.text.stringValue() : undefined).toBe('')
  expect(message?.exploded).toBe(true)
  expect(message?.explodedBy).toBe('bob')
  expect(message?.type === 'text' ? message.flipGameID : undefined).toBe('')
  expect(message?.type === 'text' ? [...(message.mentionsAt ?? [])] : undefined).toEqual([])
  expect(message?.reactions?.size ?? 0).toBe(0)
  expect(message?.unfurls?.size ?? 0).toBe(0)
})

test('messagesClear resets all message indexes and maps', () => {
  const store = seedStoreWithAnchoredMessage()
  applyState(store, {
    loaded: true,
    validatedOrdinalRange: {from: ordinal, to: ordinal},
  })
  store.getState().dispatch.messagesClear()
  expect(store.getState().loaded).toBe(false)
  expect(store.getState().messageMap.size).toBe(0)
  expect(store.getState().messageOrdinals).toBeUndefined()
  expect(store.getState().messageTypeMap.size).toBe(0)
  expect(store.getState().pendingOutboxToOrdinal.size).toBe(0)
  expect(store.getState().messageIDToOrdinal.size).toBe(0)
  expect(store.getState().validatedOrdinalRange).toBeUndefined()
})

test('initial thread loads prune stale ordinals inside the validated range', async () => {
  const missingMsgID = T.Chat.numberToMessageID(902)
  const attachment = makeAttachmentMessage({
    id: missingMsgID,
    ordinal: T.Chat.numberToOrdinal(902),
  })
  const store = seedStore([
    makeTextMessage({
      id: T.Chat.numberToMessageID(901),
      ordinal: T.Chat.numberToOrdinal(901),
      outboxID: T.Chat.stringToOutboxID('kept-first'),
    }),
    attachment,
    makeTextMessage({
      id: T.Chat.numberToMessageID(903),
      ordinal: T.Chat.numberToOrdinal(903),
      outboxID: T.Chat.stringToOutboxID('kept-last'),
    }),
  ])
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [
          makeValidTextUIMessage(T.Chat.numberToMessageID(901), 'kept first'),
          makeValidTextUIMessage(T.Chat.numberToMessageID(903), 'kept last'),
        ],
        pagination: {last: true, next: '', num: 2, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })

  store.getState().dispatch.loadMoreMessages({reason: 'centered'})
  await flushPromises()

  expect(store.getState().messageOrdinals).toEqual([
    T.Chat.numberToOrdinal(901),
    T.Chat.numberToOrdinal(903),
  ])
  expect(store.getState().messageMap.has(attachment.ordinal)).toBe(false)
  expect(store.getState().messageIDToOrdinal.has(missingMsgID)).toBe(false)
  expect(store.getState().messageTypeMap.has(attachment.ordinal)).toBe(false)
  expect(store.getState().validatedOrdinalRange).toEqual({
    from: T.Chat.numberToOrdinal(901),
    to: T.Chat.numberToOrdinal(903),
  })
})

test('server ack preserves the outbox-anchored ordinal and later msgID lookups hit that row', () => {
  const store = createStore()
  const pendingOrdinal = T.Chat.numberToOrdinal(10.001)
  const serverMsgID = T.Chat.numberToMessageID(202)
  const pendingMessage = makePendingTextMessage(pendingOrdinal, outboxID, 'pending hello')
  const baseState: Partial<ConvoState> = {
    loaded: true,
    messageMap: new Map([[pendingOrdinal, pendingMessage]]),
    messageOrdinals: [pendingOrdinal],
    messageTypeMap: new Map(),
    meta: makeMeta(),
    pendingOutboxToOrdinal: new Map([[outboxID, pendingOrdinal]]),
  }
  applyState(store, baseState)

  const ack = makeValidTextUIMessage(serverMsgID, 'acked hello', {outboxID})
  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [ack],
  })

  const ackedMessage = store.getState().messageMap.get(pendingOrdinal)
  expect(store.getState().messageOrdinals).toEqual([pendingOrdinal])
  expect(ackedMessage?.id).toBe(serverMsgID)
  expect(ackedMessage?.type === 'text' ? ackedMessage.text.stringValue() : undefined).toBe('acked hello')
  expect(store.getState().messageIDToOrdinal.get(serverMsgID)).toBe(pendingOrdinal)

  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])
  store.getState().dispatch.updateReactions([{reactions, targetMsgID: serverMsgID}])

  expect(Message.getReactionOrder(store.getState().messageMap.get(pendingOrdinal)?.reactions ?? new Map())[0]).toBe(
    ':+1:'
  )

  store.getState().dispatch.messagesWereDeleted({messageIDs: [serverMsgID]})

  expect(store.getState().messageMap.has(pendingOrdinal)).toBe(false)
  expect(store.getState().messageIDToOrdinal.has(serverMsgID)).toBe(false)
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(pendingOrdinal)
})

test('placeholder updates do not overwrite an existing non-placeholder message', () => {
  const placeholderOrdinal = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(msgID))
  const store = seedStore([
    makeTextMessage({
      id: msgID,
      ordinal: placeholderOrdinal,
      outboxID: T.Chat.stringToOutboxID('existing-message'),
      text: 'kept text',
    }),
  ])

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makePlaceholderUIMessage(msgID)],
  })

  const message = store.getState().messageMap.get(placeholderOrdinal)
  expect(message?.type).toBe('text')
  expect(message?.type === 'text' ? message.text.stringValue() : undefined).toBe('kept text')
})

test('hidden placeholder updates delete the existing message row', () => {
  const hiddenMsgID = T.Chat.numberToMessageID(601)
  const hiddenOrdinal = T.Chat.numberToOrdinal(601)
  const store = seedStore([
    makeTextMessage({
      id: hiddenMsgID,
      ordinal: hiddenOrdinal,
      outboxID: T.Chat.stringToOutboxID('hidden-existing'),
    }),
  ])

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makePlaceholderUIMessage(hiddenMsgID, true)],
  })

  expect(store.getState().messageMap.has(hiddenOrdinal)).toBe(false)
  expect(store.getState().messageOrdinals).toEqual([])
  expect(store.getState().messageIDToOrdinal.has(hiddenMsgID)).toBe(false)
})

test('onMessageErrored marks the pending message as failed and leaves unknown outbox IDs alone', () => {
  const pendingOrdinal = T.Chat.numberToOrdinal(10.001)
  const knownOutboxID = T.Chat.stringToOutboxID('known-outbox')
  const store = seedStore([makePendingTextMessage(pendingOrdinal, knownOutboxID, 'pending')])

  store.getState().dispatch.onMessageErrored(knownOutboxID, 'network fail', 7)
  store.getState().dispatch.onMessageErrored(T.Chat.stringToOutboxID('missing-outbox'), 'ignored', 8)

  const message = store.getState().messageMap.get(pendingOrdinal)
  expect(message?.submitState).toBe('failed')
  expect(message?.errorReason).toBe('network fail')
  expect(message?.errorTyp).toBe(7)
})

test('local setters update participants and badge', () => {
  const store = createStore()
  const participants: ConvoState['participants'] = {
    all: ['alice', 'bob'],
    contactName: new Map([['bob', 'Bobby']]),
    name: ['alice', 'bob'],
  }

  store.getState().dispatch.setParticipants(participants)
  store.getState().dispatch.badgesUpdated(3)

  expect(store.getState().participants).toEqual(participants)
  expect(store.getState().badge).toBe(3)
})

test('local setters queue inbox row updates for visible metadata', () => {
  const queue = queueInboxRowUpdate as jest.MockedFunction<typeof queueInboxRowUpdate>
  queue.mockClear()
  const store = createStore()

  store.getState().dispatch.setMeta(makeMeta({teamname: 'acme'}))
  store.getState().dispatch.updateMeta({channelname: 'general'})
  store.getState().dispatch.badgesUpdated(3)
  store.getState().dispatch.unreadUpdated(4)
  store.getState().dispatch.setParticipants({
    all: ['alice', 'bob'],
    contactName: new Map(),
    name: ['alice', 'bob'],
  })

  expect(queue).toHaveBeenCalledTimes(5)
  expect(queue).toHaveBeenNthCalledWith(1, convID)
  expect(queue).toHaveBeenNthCalledWith(5, convID)
})

test('updateFromUIInboxLayout seeds preview metadata before trusted meta arrives', () => {
  const store = createStore()

  store.getState().dispatch.updateFromUIInboxLayout({
    channelname: '',
    draft: 'draft text',
    isMuted: true,
    layoutName: 'alice, bob',
    snippet: 'latest snippet',
    snippetDecoration: T.RPCChat.SnippetDecoration.none,
    teamname: '',
    time: 123,
  })

  expect(store.getState().meta.draft).toBe('draft text')
  expect(store.getState().meta.isMuted).toBe(true)
  expect(store.getState().meta.snippet).toBe('latest snippet')
  expect(store.getState().meta.timestamp).toBe(123)
  expect(store.getState().participants.name).toEqual(['alice', 'bob'])

  store.getState().dispatch.setMeta(makeMeta({draft: 'trusted draft'}))
  store.getState().dispatch.updateFromUIInboxLayout({
    draft: 'ignored draft',
    isMuted: false,
  })

  expect(store.getState().meta.draft).toBe('trusted draft')
})

test('loadMessagesCentered clears stale thread state and requests a centered load', () => {
  jest.spyOn(Common, 'getSelectedConversation').mockReturnValue(convID)
  const store = seedStore([
    makeTextMessage({
      id: T.Chat.numberToMessageID(301),
      ordinal: T.Chat.numberToOrdinal(301),
    }),
  ])
  applyState(store, {validatedOrdinalRange: {from: T.Chat.numberToOrdinal(301), to: T.Chat.numberToOrdinal(301)}})
  const loadMoreMessages = makeLoadMoreMessagesMock()
  const current = store.getState()
  store.setState({
    ...current,
    dispatch: {...current.dispatch, loadMoreMessages},
  })

  store.getState().dispatch.loadMessagesCentered(T.Chat.numberToMessageID(999), 'flash')

  expect(store.getState().messageMap.size).toBe(0)
  expect(store.getState().messageOrdinals).toBeUndefined()
  expect(store.getState().validatedOrdinalRange).toBeUndefined()
  expect(loadMoreMessages).toHaveBeenCalledWith(
    expect.objectContaining({
      centeredMessageID: {
        conversationIDKey: convID,
        highlightMode: 'flash',
        messageID: T.Chat.numberToMessageID(999),
      },
      messageIDControl: expect.objectContaining({
        mode: T.RPCChat.MessageIDControlMode.centered,
        pivot: T.Chat.numberToMessageID(999),
      }),
      reason: 'centered',
    })
  )
})

test('jumpToRecent clears validated search state and reloads recent messages', () => {
  const store = createStore()
  const loadMoreMessages = makeLoadMoreMessagesMock()
  const current = store.getState()
  store.setState({
    ...current,
    dispatch: {...current.dispatch, loadMoreMessages},
    validatedOrdinalRange: {from: T.Chat.numberToOrdinal(1), to: T.Chat.numberToOrdinal(3)},
  })

  store.getState().dispatch.jumpToRecent()

  expect(store.getState().validatedOrdinalRange).toBeUndefined()
  expect(loadMoreMessages).toHaveBeenCalledWith({reason: 'jump to recent'})
})

test('bot membership actions send restricted and unrestricted payloads', async () => {
  const addBotMember = jest.spyOn(T.RPCChat, 'localAddBotMemberRpcPromise').mockResolvedValue(undefined)
  const store = createStore()

  store.getState().dispatch.addBotMember('helperbot', true, false, true, ['conv-a'])
  store.getState().dispatch.addBotMember('openbot', false, false, false)
  await flushPromises()

  expect(addBotMember).toHaveBeenNthCalledWith(
    1,
    {
      botSettings: {cmds: true, convs: ['conv-a'], mentions: false},
      convID: T.Chat.keyToConversationID(convID),
      role: T.RPCGen.TeamRole.restrictedbot,
      username: 'helperbot',
    },
    expect.any(String)
  )
  expect(addBotMember).toHaveBeenNthCalledWith(
    2,
    {
      botSettings: null,
      convID: T.Chat.keyToConversationID(convID),
      role: T.RPCGen.TeamRole.bot,
      username: 'openbot',
    },
    expect.any(String)
  )
})

test('bot edit and remove actions send service payloads with waiting keys', async () => {
  const editBotSettings = jest
    .spyOn(T.RPCChat, 'localSetBotMemberSettingsRpcPromise')
    .mockResolvedValue(undefined)
  const removeBotMember = jest.spyOn(T.RPCChat, 'localRemoveBotMemberRpcPromise').mockResolvedValue(undefined)
  const store = createStore()

  store.getState().dispatch.editBotSettings('helperbot', false, true, ['conv-b'])
  store.getState().dispatch.removeBotMember('helperbot')
  await flushPromises()

  expect(editBotSettings).toHaveBeenCalledWith(
    {
      botSettings: {cmds: false, convs: ['conv-b'], mentions: true},
      convID: T.Chat.keyToConversationID(convID),
      username: 'helperbot',
    },
    expect.any(String)
  )
  expect(removeBotMember).toHaveBeenCalledWith(
    {
      convID: T.Chat.keyToConversationID(convID),
      username: 'helperbot',
    },
    expect.any(String)
  )
})

test('selectedConversation can defer thread load for route-owned highlight', () => {
  const store = createStore()
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
  const loadMoreMessages = makeLoadMoreMessagesMock()
  const current = store.getState()
  store.setState({
    dispatch: {...current.dispatch, loadMoreMessages},
  })

  store.getState().dispatch.selectedConversation(true)
  store.getState().dispatch.selectedConversation()

  expect(loadMoreMessages).toHaveBeenCalledTimes(1)
})

test('setMarkAsUnread false is a no-op', () => {
  const store = createStore()
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})

  store.getState().dispatch.setMarkAsUnread(false)

  expect(markAsRead).not.toHaveBeenCalled()
})

test('setMarkAsUnread marks the previous visible message as the unread line', async () => {
  useConfigState.setState({loggedIn: true})
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const store = seedStore([
    makeTextMessage({
      id: T.Chat.numberToMessageID(801),
      ordinal: T.Chat.numberToOrdinal(801),
      outboxID: T.Chat.stringToOutboxID('before-unread'),
    }),
    makeTextMessage({
      id: T.Chat.numberToMessageID(802),
      ordinal: T.Chat.numberToOrdinal(802),
      outboxID: T.Chat.stringToOutboxID('at-unread'),
    }),
  ])
  applyState(store, {meta: makeMeta({maxVisibleMsgID: T.Chat.numberToMessageID(802)})})

  store.getState().dispatch.setMarkAsUnread(T.Chat.numberToMessageID(802))
  await flushPromises()

  expect(markAsRead).toHaveBeenCalledWith({
    conversationID: T.Chat.keyToConversationID(convID),
    forceUnread: true,
    msgID: T.Chat.numberToMessageID(801),
  })
})

test('setMarkAsUnread loads a tiny thread window when the message map is empty', async () => {
  useConfigState.setState({loggedIn: true})
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  let threadRequest:
    | Parameters<typeof T.RPCChat.localGetThreadNonblockRpcListener>[0]
    | undefined
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    threadRequest = p
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [
          makeValidTextUIMessage(T.Chat.numberToMessageID(900), 'newer'),
          makeValidTextUIMessage(T.Chat.numberToMessageID(899), 'older'),
        ],
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const store = createStore()
  applyState(store, {meta: makeMeta({maxVisibleMsgID: T.Chat.numberToMessageID(900)})})

  store.getState().dispatch.setMarkAsUnread()
  await flushPromises()

  expect(threadRequest?.params.pagination).toEqual({
    last: false,
    next: '',
    num: 2,
    previous: '',
  })
  expect(markAsRead).toHaveBeenCalledWith({
    conversationID: T.Chat.keyToConversationID(convID),
    forceUnread: true,
    msgID: T.Chat.numberToMessageID(899),
  })
})

test('selectedConversation resets threadLoadStatus', () => {
  const store = createStore()
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
  const loadMoreMessages = makeLoadMoreMessagesMock()
  const current = store.getState()
  store.setState({
    ...current,
    dispatch: {...current.dispatch, loadMoreMessages},
    threadLoadStatus: T.RPCChat.UIChatThreadStatusTyp.server,
  })

  store.getState().dispatch.selectedConversation()

  expect(store.getState().threadLoadStatus).toBe(T.RPCChat.UIChatThreadStatusTyp.none)
})

test('syncBadgeState updates listed conversations and clears missing badges', () => {
  const firstConvID = T.Chat.conversationIDToKey(new Uint8Array([9, 8, 7, 6]))
  const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([6, 7, 8, 9]))
  const store = getConvoState(firstConvID)
  const otherStore = getConvoState(otherConvID)

  store.dispatch.badgesUpdated(3)
  store.dispatch.unreadUpdated(4)
  otherStore.dispatch.badgesUpdated(2)
  otherStore.dispatch.unreadUpdated(5)

  syncBadgeState({
    bigTeamBadgeCount: 0,
    conversations: [
      {
        badgeCount: 1,
        convID: T.Chat.keyToConversationID(otherConvID),
        unreadMessages: 6,
      },
    ],
    homeTodoItems: 0,
    inboxVers: 0,
    newDevices: null,
    newFollowers: 0,
    newGitRepoGlobalUniqueIDs: [],
    newTeamAccessRequestCount: 0,
    newTeams: [],
    newTlfs: 0,
    rekeysNeeded: 0,
    resetState: {active: false, endTime: 0},
    revokedDevices: null,
    smallTeamBadgeCount: 1,
    teamsWithResetUsers: null,
    unverifiedEmails: 0,
    unverifiedPhones: 0,
  } as any)

  expect(getConvoState(firstConvID).badge).toBe(0)
  expect(getConvoState(firstConvID).unread).toBe(4)
  expect(getConvoState(otherConvID).badge).toBe(1)
  expect(getConvoState(otherConvID).unread).toBe(6)
})
