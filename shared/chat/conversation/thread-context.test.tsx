/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Common from '@/constants/chat/common'
import * as Meta from '@/constants/chat/meta'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import {participantInfoReceived} from '@/chat/inbox/metadata'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {
  getConversationThreadCacheSnapshot,
  putConversationThreadCacheSnapshot,
  type ConversationThreadSnapshot,
} from './thread-cache'
import {
  ConversationThreadProvider,
  useConversationThreadAccountsInfoMap,
  useConversationThreadCoinFlipStatus,
  useConversationThreadJumpToRecent,
  useConversationThreadLoadMessagesCentered,
  useConversationThreadMessage,
  useConversationThreadMessageOrdinalsMaybe,
  useConversationThreadPaymentStatus,
  useConversationThreadParticipants,
  useConversationThreadTyping,
  useConversationThreadUnfurlPromptDomains,
} from './thread-context'

jest.mock('@/stores/inbox-rows', () => ({
  flushInboxRowUpdates: jest.fn(),
  getInboxRowTrustedState: jest.fn(() => undefined),
  queueInboxRowUpdate: jest.fn(),
  setInboxRowTrustedState: jest.fn(),
  syncInboxRowBadgeState: jest.fn(),
  syncInboxRowsFromLayout: jest.fn(),
  syncInboxRowsFromMetaAndParticipants: jest.fn(),
  syncInboxRowsFromMetas: jest.fn(),
  syncInboxRowsFromParticipantMap: jest.fn(),
  syncInboxRowsFromParticipants: jest.fn(),
  updateInboxRowTyping: jest.fn(),
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

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
    <ConversationThreadProvider id={convID} seedFromCache={false}>
      {children}
    </ConversationThreadProvider>
  </ConversationThreadProvider>
)

const makeThreadSnapshot = (messages: ReadonlyArray<T.Chat.Message>): ConversationThreadSnapshot => {
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
  return {
    accountsInfoMap: new Map(),
    explodingMode: 0,
    flipStatusMap: new Map(),
    loaded: true,
    messageIDToOrdinal,
    messageMap,
    messageOrdinals,
    messageTypeMap,
    meta: {...Meta.makeConversationMeta(), conversationIDKey: convID},
    moreToLoadBack: false,
    moreToLoadForward: false,
    participants: {all: [], contactName: new Map(), name: []},
    paymentStatusMap: new Map(),
    pendingOutboxToOrdinal,
    unfurlPrompt: new Map(),
  }
}

const seedThreadCache = (messages: ReadonlyArray<T.Chat.Message>) => {
  putConversationThreadCacheSnapshot(convID, makeThreadSnapshot(messages))
}

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
  seedThreadCache([makeTextMessage()])
  const {result} = renderHook(() => useConversationThreadMessage(T.Chat.numberToOrdinal(301)), {
    wrapper: nestedSameThreadWrapper,
  })

  expect(result.current?.id).toBe(T.Chat.numberToMessageID(301))
})

test('mounted thread syncs participant updates received outside its provider', () => {
  const {result} = renderHook(() => useConversationThreadParticipants(), {wrapper})
  const participantInfo = {
    all: ['alice', 'helperbot'],
    contactName: new Map<string, string>(),
    name: ['alice'],
  }

  act(() => {
    participantInfoReceived(convID, participantInfo, {
      ...Meta.makeConversationMeta(),
      conversationIDKey: convID,
    })
  })

  expect(result.current.all).toEqual(['alice', 'helperbot'])
  expect(result.current.name).toEqual(['alice'])
})

test('centered load clears stale thread state and requests a centered load', async () => {
  seedThreadCache([makeTextMessage()])
  const loadThread = jest
    .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
    .mockResolvedValue({offline: false})
  const {result} = renderHook(
    () => ({
      loadMessagesCentered: useConversationThreadLoadMessagesCentered(),
      messageOrdinals: useConversationThreadMessageOrdinalsMaybe(),
      staleMessage: useConversationThreadMessage(T.Chat.numberToOrdinal(301)),
    }),
    {wrapper}
  )
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
  const onThreadLoadStatus = jest.fn()
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({
      status: {typ: T.RPCChat.UIChatThreadStatusTyp.server},
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
})

test('mounted thread listener applies messagesUpdated for the active conversation', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  const firstMsgID = T.Chat.numberToMessageID(401)
  const {result} = renderHook(
    () => ({
      message: useConversationThreadMessage(T.Chat.numberToOrdinal(401)),
      ordinals: useConversationThreadMessageOrdinalsMaybe(),
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

test('mounted thread listener applies incoming messages for the active conversation', async () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  useConfigState.setState({loggedIn: true})
  const markAsRead = jest
    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
    .mockResolvedValue({offline: false})
  const firstMsgID = T.Chat.numberToMessageID(601)
  const {result} = renderHook(
    () => ({
      message: useConversationThreadMessage(T.Chat.numberToOrdinal(601)),
      ordinals: useConversationThreadMessageOrdinalsMaybe(),
    }),
    {wrapper}
  )

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

  expect(result.current.ordinals).toEqual([T.Chat.numberToOrdinal(601)])
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

test('mounted thread listener applies failed outbox messages for the active conversation', () => {
  const pendingOrdinal = T.Chat.numberToOrdinal(801)
  const pendingOutboxID = T.Chat.stringToOutboxID('0a0b')
  seedThreadCache([
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
  const {result} = renderHook(() => useConversationThreadMessage(pendingOrdinal), {wrapper})

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

  expect(result.current?.submitState).toBe('failed')
  expect(result.current?.errorReason).toBe('network fail')
})

test('mounted thread listener ignores messagesUpdated for other conversations', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  renderHook(() => null, {wrapper})
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

  expect(getConversationThreadCacheSnapshot(otherConvID)).toBeUndefined()
})

test('mounted thread listener ignores incoming messages for other conversations', () => {
  jest.spyOn(Common, 'isUserActivelyLookingAtThisThread').mockReturnValue(true)
  renderHook(() => null, {wrapper})
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

  expect(getConversationThreadCacheSnapshot(otherConvID)).toBeUndefined()
})

test('mounted thread listener applies reaction updates for the active conversation', () => {
  const targetMsgID = T.Chat.numberToMessageID(301)
  seedThreadCache([makeTextMessage()])
  const {result} = renderHook(() => useConversationThreadMessage(T.Chat.numberToOrdinal(301)), {wrapper})

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

  expect(Message.getReactionOrder(result.current?.reactions ?? new Map())).toEqual([':+1:'])
})

test('mounted thread listener applies request and payment decorators for the active conversation', () => {
  const {result} = renderHook(
    () => ({
      accountsInfoMap: useConversationThreadAccountsInfoMap(),
      paymentInfo: useConversationThreadPaymentStatus('payment-1'),
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
      flipStatus: useConversationThreadCoinFlipStatus(gameID),
      promptDomains: useConversationThreadUnfurlPromptDomains(T.Chat.numberToMessageID(903)),
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
  const {result} = renderHook(() => useConversationThreadTyping(), {wrapper})

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
    id: T.Chat.numberToMessageID(702),
    ordinal: T.Chat.numberToOrdinal(702),
    outboxID: uploadOutboxID,
  })
  seedThreadCache([downloadMessage, uploadMessage])
  const {result: downloadResult} = renderHook(() => useConversationThreadMessage(downloadMessage.ordinal), {
    wrapper,
  })
  const {result: uploadResult} = renderHook(() => useConversationThreadMessage(uploadMessage.ordinal), {
    wrapper,
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
    downloadResult.current?.type === 'attachment' ? downloadResult.current.transferProgress : undefined
  ).toBe(0.25)
  expect(
    downloadResult.current?.type === 'attachment' ? downloadResult.current.transferState : undefined
  ).toBe('downloading')
  expect(uploadResult.current?.type === 'attachment' ? uploadResult.current.transferProgress : undefined).toBe(
    0.5
  )
  expect(uploadResult.current?.type === 'attachment' ? uploadResult.current.transferState : undefined).toBe(
    'uploading'
  )

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
    downloadResult.current?.type === 'attachment' ? downloadResult.current.transferState : undefined
  ).toBeUndefined()
})
