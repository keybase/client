/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import {participantInfoReceived} from '@/chat/inbox/metadata'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useShellState} from '@/stores/shell'
import {resetAllStores} from '@/util/zustand'
import {
  ConversationThreadProvider,
  LiveConversationThreadProvider,
  useConversationThreadActions,
  useConversationThreadJumpToRecent,
  useConversationThreadLoadMoreMessages,
  useConversationThreadLoadMessagesCentered,
  useConversationThreadLoadOlderMessagesDueToScroll,
  useConversationThreadMarkThreadAsRead,
  useConversationThreadMessage,
  useConversationThreadMessageActions,
  useConversationThreadSelector,
  useConversationThreadStore,
} from './thread-context'
import {ConversationThreadLoadStatusProvider} from './thread-load-status-context'
import {useConversationParticipants} from './data-hooks'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const emptyStringSet = new Set<string>()

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const textAt = (n: number) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    timestamp: 100,
  })

const makeTextMessage = () =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(301),
    ordinal: T.Chat.numberToOrdinal(301),
    outboxID: T.Chat.stringToOutboxID('outbox-1'),
    text: new HiddenString('stale message'),
    timestamp: 100,
  })

const makeAttachmentMessage = (override?: Partial<T.Chat.MessageAttachment>) =>
  Message.makeMessageAttachment({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(701),
    ordinal: T.Chat.numberToOrdinal(701),
    outboxID: T.Chat.stringToOutboxID('attachment-outbox'),
    timestamp: 100,
    title: 'attachment',
    transferProgress: 0,
    ...override,
  })

const makeValidTextUIMessage = (serverMsgID: T.Chat.MessageID, text: string): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: {
    atMentions: null,
    bodySummary: text,
    botUsername: '',
    channelMention: T.RPCChat.ChannelMention.none,
    channelNameMentions: null,
    ctime: 200,
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
    outboxID: '',
    paymentInfos: null,
    pinnedMessageID: null,
    reactions: {},
    replyTo: null,
    requestInfo: null,
    senderDeviceID: new Uint8Array([1]),
    senderDeviceName: 'bob-device',
    senderDeviceRevokedAt: null,
    senderDeviceType: 'desktop',
    senderUID: new Uint8Array([2]),
    senderUsername: 'bob',
    superseded: false,
    unfurls: null,
  },
})

const makeIncomingTextMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  serverMsgID: T.Chat.MessageID,
  text: string
): T.RPCChat.IncomingMessage => ({
  conv: null,
  convID: T.Chat.keyToConversationID(conversationIDKey),
  desktopNotificationSnippet: '',
  displayDesktopNotification: false,
  message: makeValidTextUIMessage(serverMsgID, text),
  modifiedMessage: null,
  pagination: null,
})

const makeIncomingOutboxReaction = (
  conversationIDKey: T.Chat.ConversationIDKey,
  outboxID: Uint8Array,
  targetMsgID: T.Chat.MessageID,
  body: string,
  decorated = body
): T.RPCChat.IncomingMessage => ({
  conv: null,
  convID: T.Chat.keyToConversationID(conversationIDKey),
  desktopNotificationSnippet: '',
  displayDesktopNotification: false,
  message: {
    outbox: {
      body,
      ctime: 200,
      decoratedTextBody: decorated,
      filename: '',
      isEphemeral: false,
      messageType: T.RPCChat.MessageType.reaction,
      ordinal: T.Chat.messageIDToNumber(targetMsgID) + 0.001,
      outboxID: T.Chat.rpcOutboxIDToOutboxID(outboxID),
      preview: null,
      replyTo: null,
      state: {sending: 0, state: T.RPCChat.OutboxStateType.sending},
      supersedes: T.Chat.messageIDToNumber(targetMsgID),
      title: '',
    },
    state: T.RPCChat.MessageUnboxedState.outbox,
  },
  modifiedMessage: null,
  pagination: null,
})

const makeFailedOutboxRecord = (
  conversationIDKey: T.Chat.ConversationIDKey,
  outboxID: T.Chat.OutboxID
): T.RPCChat.OutboxRecord =>
  ({
    Msg: {},
    convID: T.Chat.keyToConversationID(conversationIDKey),
    ctime: 0,
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    ordinal: 0,
    outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID),
    state: {
      error: {
        message: 'network fail',
        typ: T.RPCChat.OutboxErrorType.misc,
      },
      state: T.RPCChat.OutboxStateType.error,
    },
  }) as T.RPCChat.OutboxRecord

const makeUIPaymentInfo = (): T.RPCChat.UIPaymentInfo =>
  ({
    accountID: 'account-id',
    amountDescription: '1 XLM',
    delta: T.RPCStellar.BalanceDelta.none,
    fromUsername: 'alice',
    issuerDescription: 'Lumens',
    note: 'payment note',
    paymentID: 'payment-1',
    showCancel: false,
    sourceAmount: '1',
    sourceAsset: {
      code: 'XLM',
      issuer: '',
      issuerName: 'Lumens',
      verifiedDomain: '',
    } as T.RPCStellar.Asset,
    status: T.RPCStellar.PaymentStatus.completed,
    statusDescription: 'Completed',
    statusDetail: '',
    toUsername: 'bob',
    worth: '$1.00',
    worthAtSendTime: '$1.00',
  }) as T.RPCChat.UIPaymentInfo

const makeUIRequestInfo = (): T.RPCChat.UIRequestInfo => ({
  amount: '1',
  amountDescription: '1 USD',
  asset: null,
  currency: 'USD',
  status: T.RPCStellar.RequestStatus.ok,
  worthAtRequestTime: '$1.00',
})

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
)

const nestedSameThreadWrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={convID}>
    <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
  </ConversationThreadProvider>
)

const liveThreadWrapper = ({children}: {children: React.ReactNode}) => (
  <LiveConversationThreadProvider id={convID}>
    {children}
  </LiveConversationThreadProvider>
)

const separatePlainThreadWrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
)

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('same-conversation nested providers reuse the outer live thread state', () => {
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      message: useConversationThreadMessage(T.Chat.numberToOrdinal(301)),
    }),
    {wrapper: nestedSameThreadWrapper}
  )

  act(() => {
    result.current.actions.addMessages([makeTextMessage()])
  })

  expect(result.current.message?.id).toBe(T.Chat.numberToMessageID(301))
})

test('separate providers do not share thread state', () => {
  const live = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      message: useConversationThreadMessage(T.Chat.numberToOrdinal(301)),
    }),
    {wrapper: liveThreadWrapper}
  )
  act(() => {
    live.result.current.actions.addMessages([makeTextMessage()])
  })
  expect(live.result.current.message?.id).toBe(T.Chat.numberToMessageID(301))

  const plain = renderHook(() => useConversationThreadMessage(T.Chat.numberToOrdinal(301)), {
    wrapper: separatePlainThreadWrapper,
  })
  expect(plain.result.current).toBeUndefined()
})

test('mounted thread syncs participant updates received outside its provider', () => {
  const {result} = renderHook(() => useConversationParticipants(convID), {wrapper})
  const participantInfo = {
    all: ['alice', 'helperbot'],
    contactName: new Map<string, string>(),
    name: ['alice'],
  }

  act(() => {
    participantInfoReceived(convID, participantInfo)
  })

  expect(result.current.all).toEqual(['alice', 'helperbot'])
  expect(result.current.name).toEqual(['alice'])
})

test('centered load clears stale thread state and requests a centered load', async () => {
  const loadThread = jest
    .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
    .mockResolvedValue({offline: false})
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      loadMessagesCentered: useConversationThreadLoadMessagesCentered(),
      messageOrdinals: useConversationThreadSelector(s => s.messageOrdinals),
      staleMessage: useConversationThreadMessage(T.Chat.numberToOrdinal(301)),
    }),
    {wrapper}
  )

  act(() => {
    result.current.actions.addMessages([makeTextMessage()])
  })
  expect(result.current.staleMessage?.id).toBe(T.Chat.numberToMessageID(301))

  act(() => {
    result.current.loadMessagesCentered(T.Chat.numberToMessageID(999), 'flash')
  })
  await act(async () => {
    await flushPromises()
  })

  expect(result.current.staleMessage).toBeUndefined()
  expect(result.current.messageOrdinals).toBeUndefined()
  expect(loadThread).toHaveBeenCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({
          messageIDControl: expect.objectContaining({
            mode: T.RPCChat.MessageIDControlMode.centered,
            pivot: T.Chat.numberToMessageID(999),
          }),
        }),
      }),
    })
  )
})

test('jumpToRecent reloads recent messages through the mounted thread action', async () => {
  useConfigState.setState({loggedIn: true})
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const onThreadLoadStatus = jest.fn()
  const msgID = T.Chat.numberToMessageID(202)
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({
      status: {typ: T.RPCChat.UIChatThreadStatusTyp.server},
    })
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(msgID, 'recent')],
        pagination: {last: true, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(() => useConversationThreadJumpToRecent(), {wrapper})

  act(() => {
    result.current({onThreadLoadStatus})
  })
  await act(async () => {
    await flushPromises()
  })

  expect(onThreadLoadStatus).toHaveBeenCalledWith(convID, T.RPCChat.UIChatThreadStatusTyp.server)
  expect(markAsRead).toHaveBeenCalledWith({
    conversationID: T.Chat.keyToConversationID(convID),
    forceUnread: false,
    msgID,
  })
})

test('mark-read disabled latest load does not arm active or explicit mark read', async () => {
  useConfigState.setState({loggedIn: true})
  useShellState.getState().dispatch.setActive(false)
  jest
    .spyOn(Common, 'isUserActivelyLookingAtThisThread')
    .mockImplementation(() => useShellState.getState().active)
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const msgID = T.Chat.numberToMessageID(203)
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(msgID, 'search latest')],
        pagination: {last: true, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(
    () => ({
      loadMoreMessages: useConversationThreadLoadMoreMessages(),
      markThreadAsRead: useConversationThreadMarkThreadAsRead(),
    }),
    {wrapper}
  )

  act(() => {
    result.current.loadMoreMessages({allowMarkAsRead: false, reason: 'focused'})
  })
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).not.toHaveBeenCalled()

  act(() => {
    useShellState.getState().dispatch.setActive(true)
  })
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).not.toHaveBeenCalled()

  act(() => {
    result.current.markThreadAsRead()
  })
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).not.toHaveBeenCalled()
})

test('scrollback loads older messages without marking the thread read', async () => {
  useConfigState.setState({loggedIn: true})
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(T.Chat.numberToMessageID(201), 'older')],
        pagination: {last: false, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      loadOlderMessagesDueToScroll: useConversationThreadLoadOlderMessagesDueToScroll(),
    }),
    {wrapper}
  )

  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [makeTextMessage()],
      moreToLoad: true,
      scrollDirection: 'back',
    })
  })

  act(() => {
    result.current.loadOlderMessagesDueToScroll(1)
  })
  await act(async () => {
    await flushPromises()
  })

  expect(markAsRead).not.toHaveBeenCalled()
})

test('mounted thread listener applies messagesUpdated for the active conversation', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  const firstMsgID = T.Chat.numberToMessageID(401)
  const {result} = renderHook(
    () => ({
      message: useConversationThreadMessage(T.Chat.numberToOrdinal(401)),
      ordinals: useConversationThreadSelector(s => s.messageOrdinals),
    }),
    {wrapper}
  )

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.messagesUpdated,
            messagesUpdated: {
              convID: T.Chat.keyToConversationID(convID),
              updates: [makeValidTextUIMessage(firstMsgID, 'updated')],
            },
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current.ordinals).toEqual([T.Chat.numberToOrdinal(401)])
  expect(result.current.message?.id).toBe(firstMsgID)
})

// The full jump -> scroll-to-bottom -> stale-reload chain behind normal/container.tsx's
// allowMarkReadOnLoad. Jumping to a highlighted message mounts the thread with
// skipThreadLoadOnSelection (the centered load replaces the select-on-mount load) and blocks
// mark-read. The block is NOT permanent: applyThreadLoad releases it as soon as the user scrolls
// to the latest message ('forward' with no moreToLoad). The stale reload that follows -
// ChatThreadsStale fires on every mobile background -> foreground - must then be free to mark the
// thread read. reloadStaleThread reads allowMarkReadOnLoad through useEffectEvent, i.e. the latest
// render's value, so a caller that derived it from the one-shot highlight and froze it at `false`
// would leave the conversation badged unread for as long as the thread stayed mounted.
const staleThreadUpdate = {
  payload: {
    params: {
      uid: '',
      updates: [
        {convID: T.Chat.keyToConversationID(convID), updateType: T.RPCChat.StaleUpdateType.newactivity},
      ],
    },
  },
  type: 'chat.1.NotifyChat.ChatThreadsStale',
} as never

const renderJumpedThenScrolledToBottom = (allowMarkReadOnLoad: boolean) => {
  useConfigState.setState({loggedIn: true})
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(T.Chat.numberToMessageID(203), 'latest')],
        pagination: {last: true, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(() => useConversationThreadActions(), {
    wrapper: ({children}: {children: React.ReactNode}) => (
      <ConversationThreadProvider id={convID}>
        <ConversationThreadLoadStatusProvider
          allowMarkReadOnLoad={allowMarkReadOnLoad}
          id={convID}
          skipThreadLoadOnSelection={true}
        >
          {children}
        </ConversationThreadLoadStatusProvider>
      </ConversationThreadProvider>
    ),
  })
  // jumping to a highlighted message blocks mark-read
  act(() => {
    result.current.setMarkReadBlocked(true)
  })
  // ...then the user scrolls all the way forward to the latest message, releasing the block
  act(() => {
    result.current.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [makeTextMessage()],
      moreToLoad: false,
      scrollDirection: 'forward',
    })
  })
  return markAsRead
}

test('a stale reload after a jump and a scroll to the bottom marks the thread read', async () => {
  const markAsRead = renderJumpedThenScrolledToBottom(true)

  act(() => {
    notifyEngineActionListeners(staleThreadUpdate)
  })
  await act(async () => {
    await flushPromises()
  })

  expect(markAsRead).toHaveBeenCalledTimes(1)
})

// The counterfactual: exactly what deriving allowMarkReadOnLoad from the one-shot highlight did.
test('a stale reload that disallows mark read leaves the thread unread even once the block is gone', async () => {
  const markAsRead = renderJumpedThenScrolledToBottom(false)

  act(() => {
    notifyEngineActionListeners(staleThreadUpdate)
  })
  await act(async () => {
    await flushPromises()
  })

  expect(markAsRead).not.toHaveBeenCalled()
})

test('mounted thread listener applies incoming messages for the active conversation', async () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  useConfigState.setState({loggedIn: true})
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const loadedMsgID = T.Chat.numberToMessageID(600)
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(loadedMsgID, 'loaded')],
        pagination: {last: true, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const firstMsgID = T.Chat.numberToMessageID(601)
  const {result} = renderHook(
    () => ({
      loadMoreMessages: useConversationThreadLoadMoreMessages(),
      message: useConversationThreadMessage(T.Chat.numberToOrdinal(601)),
      ordinals: useConversationThreadSelector(s => s.messageOrdinals),
    }),
    {wrapper}
  )

  act(() => {
    result.current.loadMoreMessages({reason: 'focused'})
  })
  await act(async () => {
    await flushPromises()
  })
  markAsRead.mockClear()

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.incomingMessage,
            incomingMessage: makeIncomingTextMessage(convID, firstMsgID, 'incoming'),
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current.ordinals).toEqual([
    T.Chat.numberToOrdinal(600),
    T.Chat.numberToOrdinal(601),
  ])
  expect(result.current.message?.id).toBe(firstMsgID)
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).toHaveBeenCalledTimes(1)
  expect(markAsRead).toHaveBeenCalledWith({
    conversationID: T.Chat.keyToConversationID(convID),
    forceUnread: false,
    msgID: firstMsgID,
  })
})

test('mounted thread listener applies incoming messages while inactive without marking read', async () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(false)
  useConfigState.setState({loggedIn: true})
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const firstMsgID = T.Chat.numberToMessageID(602)
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      message: useConversationThreadMessage(T.Chat.numberToOrdinal(602)),
      ordinals: useConversationThreadSelector(s => s.messageOrdinals),
    }),
    {wrapper}
  )

  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [],
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.incomingMessage,
            incomingMessage: makeIncomingTextMessage(convID, firstMsgID, 'inactive incoming'),
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current.ordinals).toEqual([T.Chat.numberToOrdinal(602)])
  expect(result.current.message?.id).toBe(firstMsgID)
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).not.toHaveBeenCalled()
})

test('active change marks read after an eligible mounted thread load', async () => {
  useConfigState.setState({loggedIn: true})
  useShellState.getState().dispatch.setActive(false)
  jest
    .spyOn(Common, 'isUserActivelyLookingAtThisThread')
    .mockImplementation(() => useShellState.getState().active)
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const msgID = T.Chat.numberToMessageID(603)
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(msgID, 'loaded inactive')],
        pagination: {last: true, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(() => useConversationThreadLoadMoreMessages(), {wrapper})

  act(() => {
    result.current({reason: 'tab selected'})
  })
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).not.toHaveBeenCalled()

  act(() => {
    useShellState.getState().dispatch.setActive(true)
  })
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).toHaveBeenCalledWith({
    conversationID: T.Chat.keyToConversationID(convID),
    forceUnread: false,
    msgID,
  })
})

test('active change does not mark read after a centered thread load', async () => {
  useConfigState.setState({loggedIn: true})
  useShellState.getState().dispatch.setActive(false)
  jest
    .spyOn(Common, 'isUserActivelyLookingAtThisThread')
    .mockImplementation(() => useShellState.getState().active)
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const msgID = T.Chat.numberToMessageID(604)
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(msgID, 'centered inactive')],
        pagination: {last: true, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(() => useConversationThreadLoadMessagesCentered(), {wrapper})

  act(() => {
    result.current(msgID, 'flash')
  })
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).not.toHaveBeenCalled()

  act(() => {
    useShellState.getState().dispatch.setActive(true)
  })
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).not.toHaveBeenCalled()
})

test('mounted thread listener applies failed outbox messages for the active conversation', () => {
  const pendingOrdinal = T.Chat.numberToOrdinal(801)
  const pendingOutboxID = T.Chat.stringToOutboxID('0a0b')
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      message: useConversationThreadMessage(pendingOrdinal),
    }),
    {wrapper}
  )

  act(() => {
    result.current.actions.addMessages([
      Message.makeMessageText({
        author: 'alice',
        conversationIDKey: convID,
        ordinal: pendingOrdinal,
        outboxID: pendingOutboxID,
        submitState: 'pending',
        text: new HiddenString('pending'),
        timestamp: 300,
      }),
    ])
  })

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.failedMessage,
            failedMessage: {
              conv: null,
              isEphemeralPurge: false,
              outboxRecords: [makeFailedOutboxRecord(convID, pendingOutboxID)],
            },
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current.message?.submitState).toBe('failed')
  expect(result.current.message?.errorReason).toBe('network fail')
})

test('mounted thread listener ignores messagesUpdated for other conversations', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  const {result} = renderHook(
    () => useConversationThreadMessage(T.Chat.numberToOrdinal(501)),
    {wrapper}
  )
  const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([9, 8, 7, 6]))

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.messagesUpdated,
            messagesUpdated: {
              convID: T.Chat.keyToConversationID(otherConvID),
              updates: [makeValidTextUIMessage(T.Chat.numberToMessageID(501), 'ignored')],
            },
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current).toBeUndefined()
})

test('mounted thread listener ignores incoming messages for other conversations', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  const {result} = renderHook(
    () => useConversationThreadMessage(T.Chat.numberToOrdinal(701)),
    {wrapper}
  )
  const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([9, 8, 7, 6]))

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.incomingMessage,
            incomingMessage: makeIncomingTextMessage(
              otherConvID,
              T.Chat.numberToMessageID(701),
              'ignored'
            ),
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current).toBeUndefined()
})

test('mounted thread listener applies reaction updates for the active conversation', async () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  useConfigState.setState({loggedIn: true})
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const targetMsgID = T.Chat.numberToMessageID(301)
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(targetMsgID, 'loaded')],
        pagination: {last: true, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(
    () => ({
      loadMoreMessages: useConversationThreadLoadMoreMessages(),
      message: useConversationThreadMessage(T.Chat.numberToOrdinal(301)),
    }),
    {wrapper}
  )

  act(() => {
    result.current.loadMoreMessages({reason: 'focused'})
  })
  await act(async () => {
    await flushPromises()
  })
  markAsRead.mockClear()

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.reactionUpdate,
            reactionUpdate: {
              convID: T.Chat.keyToConversationID(convID),
              reactionUpdates: [
                {
                  reactions: {
                    reactions: {
                      ':+1:': {
                        decorated: ':+1:',
                        users: {
                          bob: {
                            ctime: 5,
                            reactionMsgID: T.Chat.messageIDToNumber(T.Chat.numberToMessageID(99)),
                          },
                        },
                      },
                    },
                  },
                  targetMsgID: T.Chat.messageIDToNumber(targetMsgID),
                },
              ],
              userReacjis: {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: null},
            },
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(Message.getReactionOrder(result.current.message?.reactions ?? new Map())).toEqual([':+1:'])
  await act(async () => {
    await flushPromises()
  })
  expect(markAsRead).toHaveBeenCalledWith({
    conversationID: T.Chat.keyToConversationID(convID),
    forceUnread: false,
    msgID: targetMsgID,
  })
})

test('loaded focus refresh does not overwrite newer streamed reaction updates', async () => {
  const targetMsgID = T.Chat.numberToMessageID(301)
  const targetOrdinal = T.Chat.numberToOrdinal(301)
  let incomingCallMap:
    | Parameters<typeof T.RPCChat.localGetThreadNonblockRpcListener>[0]['incomingCallMap']
    | undefined
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    incomingCallMap = p.incomingCallMap
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      loadMoreMessages: useConversationThreadLoadMoreMessages(),
      message: useConversationThreadMessage(targetOrdinal),
    }),
    {wrapper}
  )

  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: true,
      messages: [makeTextMessage()],
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })

  act(() => {
    result.current.loadMoreMessages({reason: 'tab selected'})
  })
  await act(async () => {
    await flushPromises()
  })

  expect(incomingCallMap).toBeDefined()

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.reactionUpdate,
            reactionUpdate: {
              convID: T.Chat.keyToConversationID(convID),
              reactionUpdates: [
                {
                  reactions: {
                    reactions: {
                      ':+1:': {
                        decorated: ':+1:',
                        users: {
                          alice: {
                            ctime: 300,
                            reactionMsgID: T.Chat.messageIDToNumber(T.Chat.numberToMessageID(99)),
                          },
                        },
                      },
                    },
                  },
                  targetMsgID: T.Chat.messageIDToNumber(targetMsgID),
                },
              ],
              userReacjis: {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: null},
            },
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current.message?.reactions?.get(':+1:')?.users.map(u => u.username)).toEqual(['alice'])

  act(() => {
    incomingCallMap?.['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(targetMsgID, 'stale server copy')],
        pagination: {last: true, next: '', num: 20, previous: ''},
      }),
    })
  })

  expect(result.current.message?.reactions?.get(':+1:')?.users.map(u => u.username)).toEqual(['alice'])
})

test('toggleMessageReaction overlays locally without mutating server reactions', async () => {
  const targetMsgID = T.Chat.numberToMessageID(301)
  const targetOrdinal = T.Chat.numberToOrdinal(301)
  const postReaction = jest
    .spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise')
    .mockImplementation(async p => {
      const outboxID = await Promise.resolve(p.outboxID ?? new Uint8Array())
      return {
        identifyFailures: null,
        outboxID,
        rateLimits: null,
      }
    })
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      message: useConversationThreadMessage(targetOrdinal),
      messageActions: useConversationThreadMessageActions(),
      store: useConversationThreadStore(),
    }),
    {wrapper}
  )

  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [makeTextMessage()],
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })

  act(() => {
    result.current.messageActions.toggleMessageReaction(targetOrdinal, ':+1:')
  })

  expect(result.current.message?.reactions?.get(':+1:')?.users.map(u => u.username)).toEqual(['alice'])
  expect(result.current.store.getState().messageMap.get(targetOrdinal)?.reactions).toBeUndefined()
  await act(async () => {
    await flushPromises()
  })

  const outboxID = postReaction.mock.calls[0]?.[0].outboxID
  expect(outboxID).toBeDefined()

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.incomingMessage,
            incomingMessage: makeIncomingOutboxReaction(
              convID,
              outboxID!,
              targetMsgID,
              ':+1:',
              'decorated-plus-one'
            ),
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current.message?.reactions?.get(':+1:')?.users.map(u => u.username)).toEqual(['alice'])
  expect(result.current.message?.reactions?.get(':+1:')?.decorated).toBe('decorated-plus-one')
  expect(result.current.store.getState().messageMap.get(targetOrdinal)?.reactions).toBeUndefined()

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          activity: {
            activityType: T.RPCChat.ChatActivityType.reactionUpdate,
            reactionUpdate: {
              convID: T.Chat.keyToConversationID(convID),
              reactionUpdates: [
                {
                  reactions: {
                    reactions: {
                      ':+1:': {
                        decorated: 'server-plus-one',
                        users: {
                          alice: {
                            ctime: 300,
                            reactionMsgID: T.Chat.messageIDToNumber(T.Chat.numberToMessageID(99)),
                          },
                        },
                      },
                    },
                  },
                  targetMsgID: T.Chat.messageIDToNumber(targetMsgID),
                },
              ],
              userReacjis: {skinTone: T.RPCGen.ReacjiSkinTone.none, topReacjis: null},
            },
          },
        },
      },
      type: 'chat.1.NotifyChat.NewChatActivity',
    } as never)
  })

  expect(result.current.store.getState().optimisticReactionMap.size).toBe(0)
  expect(result.current.store.getState().messageMap.get(targetOrdinal)?.reactions?.get(':+1:')).toEqual({
    decorated: 'server-plus-one',
    users: [{timestamp: 300, username: 'alice'}],
  })
})

test('mounted thread listener applies request and payment decorators for the active conversation', () => {
  const {result} = renderHook(
    () => ({
      accountsInfoMap: useConversationThreadSelector(s => s.accountsInfoMap),
      paymentInfo: useConversationThreadSelector(s => s.paymentStatusMap.get('payment-1')),
    }),
    {wrapper}
  )

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          convID: T.Chat.keyToConversationID(convID),
          info: makeUIRequestInfo(),
          msgID: T.Chat.messageIDToNumber(T.Chat.numberToMessageID(901)),
          uid: new Uint8Array([1]),
        },
      },
      type: 'chat.1.NotifyChat.ChatRequestInfo',
    } as never)
    notifyEngineActionListeners({
      payload: {
        params: {
          convID: T.Chat.keyToConversationID(convID),
          info: makeUIPaymentInfo(),
          msgID: T.Chat.messageIDToNumber(T.Chat.numberToMessageID(902)),
          uid: new Uint8Array([1]),
        },
      },
      type: 'chat.1.NotifyChat.ChatPaymentInfo',
    } as never)
  })

  expect(result.current.accountsInfoMap.get(T.Chat.numberToMessageID(901))?.type).toBe('requestInfo')
  expect(result.current.accountsInfoMap.get(T.Chat.numberToMessageID(902))?.type).toBe('paymentInfo')
  expect(result.current.paymentInfo?.status).toBe('completed')
})

test('mounted thread listener applies unfurl prompts and coin flip status for the active conversation', () => {
  const gameID = 'flip-1'
  const {result} = renderHook(
    () => ({
      flipStatus: useConversationThreadSelector(s => s.flipStatusMap.get(gameID)),
      promptDomains: useConversationThreadSelector(
        s => s.unfurlPrompt.get(T.Chat.numberToMessageID(903)) ?? emptyStringSet
      ),
    }),
    {wrapper}
  )

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          convID: T.Chat.keyToConversationID(convID),
          domain: 'keybase.io',
          msgID: T.Chat.messageIDToNumber(T.Chat.numberToMessageID(903)),
        },
      },
      type: 'chat.1.NotifyChat.ChatPromptUnfurl',
    } as never)
    notifyEngineActionListeners({
      payload: {
        params: {
          statuses: [
            {
              commitmentVisualization: '',
              convID,
              errorInfo: null,
              gameID,
              participants: [],
              phase: T.RPCChat.UICoinFlipPhase.commitment,
              progressText: 'Collecting commitments',
              resultInfo: null,
              resultText: '',
              revealVisualization: '',
            },
          ],
        },
      },
      type: 'chat.1.chatUi.chatCoinFlipStatus',
    } as never)
  })

  expect([...result.current.promptDomains]).toEqual(['keybase.io'])
  expect(result.current.flipStatus?.gameID).toBe(gameID)
})

test('mounted thread listener applies typing updates for the active conversation', () => {
  const {result} = renderHook(() => useConversationThreadSelector(s => s.typing), {wrapper})

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          typingUpdates: [
            {
              convID: T.Chat.keyToConversationID(convID),
              typers: [{deviceID: 'device-id', uid: 'uid', username: 'bob'}],
            },
          ],
        },
      },
      type: 'chat.1.NotifyChat.ChatTypingUpdate',
    } as never)
  })

  expect([...result.current]).toEqual(['bob'])
})

test('mounted thread listener applies attachment download and upload progress', () => {
  const downloadMessage = makeAttachmentMessage({
    id: T.Chat.numberToMessageID(701),
    ordinal: T.Chat.numberToOrdinal(701),
  })
  const uploadOutboxID = T.Chat.stringToOutboxID('0c0d')
  const uploadRpcOutboxID = T.Chat.outboxIDToRpcOutboxID(uploadOutboxID)
  const uploadMessage = makeAttachmentMessage({
    id: T.Chat.numberToMessageID(0),
    ordinal: T.Chat.numberToOrdinal(702),
    outboxID: uploadOutboxID,
  })
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      downloadMessage: useConversationThreadMessage(downloadMessage.ordinal),
      uploadMessage: useConversationThreadMessage(uploadMessage.ordinal),
    }),
    {wrapper}
  )

  act(() => {
    result.current.actions.addMessages([downloadMessage, uploadMessage])
  })

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          bytesComplete: 25,
          bytesTotal: 100,
          convID: T.Chat.keyToConversationID(convID),
          msgID: T.Chat.messageIDToNumber(downloadMessage.id),
        },
      },
      type: 'chat.1.NotifyChat.ChatAttachmentDownloadProgress',
    } as never)
    notifyEngineActionListeners({
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
  })

  expect(
    result.current.downloadMessage?.type === 'attachment'
      ? result.current.downloadMessage.transferProgress
      : undefined
  ).toBe(0.25)
  expect(
    result.current.downloadMessage?.type === 'attachment'
      ? result.current.downloadMessage.transferState
      : undefined
  ).toBe('downloading')
  expect(
    result.current.uploadMessage?.type === 'attachment'
      ? result.current.uploadMessage.transferProgress
      : undefined
  ).toBe(0.5)
  expect(
    result.current.uploadMessage?.type === 'attachment' ? result.current.uploadMessage.transferState : undefined
  ).toBe('uploading')

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          convID: T.Chat.keyToConversationID(convID),
          msgID: T.Chat.messageIDToNumber(downloadMessage.id),
        },
      },
      type: 'chat.1.NotifyChat.ChatAttachmentDownloadComplete',
    } as never)
  })

  expect(
    result.current.downloadMessage?.type === 'attachment'
      ? result.current.downloadMessage.transferState
      : undefined
  ).toBeUndefined()
})

test('a cached pass never prunes messages the incremental full pass no longer resends', async () => {
  // Regression: once the service has sent a cached thread it switches the full response to
  // INCREMENTAL, so the full pass only carries the messages that changed. Treating either partial
  // response as authoritative deleted real messages that were still in the thread.
  useConfigState.setState({loggedIn: true})
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
  const ids = [301, 302, 303, 304].map(T.Chat.numberToMessageID)
  const threadJSON = (msgIDs: ReadonlyArray<T.Chat.MessageID>) =>
    JSON.stringify({
      messages: msgIDs.map(id => makeValidTextUIMessage(id, `m${id}`)),
      pagination: {last: true, next: '', num: 100, previous: ''},
    })

  // A partial cached pass missing 302/303, then an incremental full pass that SPANS the same gap -
  // it carries the oldest and newest but not the two in between. The span is what makes this
  // dangerous: a validatedRange of [301..304] computed from a partial response covers 302 and 303,
  // which are absent from that response and would be pruned. A full pass carrying only 304 gives a
  // degenerate [304..304] range with nothing to prune, and would pass even without the fix.
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({thread: threadJSON([ids[0]!, ids[3]!])})
    await Promise.resolve()
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: threadJSON([ids[0]!, ids[3]!])})
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      loadMoreMessages: useConversationThreadLoadMoreMessages(),
      ordinals: useConversationThreadSelector(s => s.messageOrdinals),
    }),
    {wrapper}
  )

  // Seed a settled four-message window the way a whole-window full pass would.
  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: ids.map(id =>
        Message.makeMessageText({
          author: 'alice',
          conversationIDKey: convID,
          id,
          ordinal: T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(id)),
          outboxID: undefined,
          text: new HiddenString(`m${id}`),
          timestamp: 100,
        })
      ),
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })
  expect(result.current.ordinals).toEqual([301, 302, 303, 304])

  act(() => {
    result.current.loadMoreMessages({reason: 'test'})
  })
  await act(async () => {
    await flushPromises()
  })

  expect(result.current.ordinals).toEqual([301, 302, 303, 304])
})

// The window invariant, at the callsite that enforces it. The four unit tests in
// thread-message-state.test.tsx pass `dropNewBelowWindow` themselves; only this proves addMessages
// actually sets it, and that thread loads are still allowed to extend the window downward.
test('a notification may not strand a new ordinal below the loaded window', () => {
  const {result} = renderHook(() => ({actions: useConversationThreadActions()}), {wrapper})

  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(7152), textAt(7153)],
      moreToLoad: true,
      scrollDirection: 'none',
    })
  })

  // A MessagesUpdated push re-unboxing the ancient METADATA message. It must not become the new
  // floor: messageOrdinals is the list's data array, so an item at index 0 far below the window
  // makes back-paging stop being a prepend and kills scrollback.
  act(() => {
    result.current.actions.addMessages([textAt(1)], {liveUpdate: true})
  })
  expect(result.current.actions.getSnapshot().messageOrdinals).toEqual([
    T.Chat.numberToOrdinal(7152),
    T.Chat.numberToOrdinal(7153),
  ])

  // A notification updating something inside the window still applies.
  act(() => {
    result.current.actions.addMessages([textAt(7152)], {liveUpdate: true})
  })
  expect(result.current.actions.getSnapshot().messageOrdinals).toEqual([
    T.Chat.numberToOrdinal(7152),
    T.Chat.numberToOrdinal(7153),
  ])

  // And a thread load - the only thing allowed to - still extends the window downward.
  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(7052)],
      moreToLoad: true,
      scrollDirection: 'back',
    })
  })
  expect(result.current.actions.getSnapshot().messageOrdinals?.[0]).toEqual(
    T.Chat.numberToOrdinal(7052)
  )
})

test('jumpToRecent drops the old window instead of merging a disjoint one into it', async () => {
  // The newest window has nothing to do with wherever the reader had scrolled back to, so merging
  // the two leaves a hole in messageOrdinals between them - which is the same stranded-index-0
  // shape that kills scrollback. A centered jump already clears first; this must too.
  useConfigState.setState({loggedIn: true})
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
  const recent = T.Chat.numberToMessageID(9001)
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
      thread: JSON.stringify({
        messages: [makeValidTextUIMessage(recent, 'newest')],
        pagination: {last: true, next: '', num: 100, previous: ''},
      }),
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(
    () => ({
      actions: useConversationThreadActions(),
      jumpToRecent: useConversationThreadJumpToRecent(),
      ordinals: useConversationThreadSelector(s => s.messageOrdinals),
    }),
    {wrapper}
  )

  // The reader is deep in old history.
  act(() => {
    result.current.actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(101), textAt(102)],
      moreToLoad: true,
      scrollDirection: 'none',
    })
  })

  act(() => {
    result.current.jumpToRecent()
  })
  await act(async () => {
    await flushPromises()
  })

  // Only the newest window survives. If the old one were merged in, ordinals would read
  // [101, 102, 9001] with a 8899-wide hole.
  expect(result.current.ordinals).toEqual([T.Chat.numberToOrdinal(9001)])
})
