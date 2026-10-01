/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {getChatRpc, loadThreadMessageIDAtIndex} from './chat-rpc'
import {threadLoadReasonToRPCReason} from './thread-load'

const loadThreadNonblock = async (p: Parameters<ReturnType<typeof getChatRpc>['loadThread']>[0]) =>
  getChatRpc().loadThread(p)

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

// every message type but the ones that only ever modify another message
const threadMessageTypes = [
  T.RPCChat.MessageType.text,
  T.RPCChat.MessageType.attachment,
  T.RPCChat.MessageType.metadata,
  T.RPCChat.MessageType.headline,
  T.RPCChat.MessageType.join,
  T.RPCChat.MessageType.leave,
  T.RPCChat.MessageType.system,
  T.RPCChat.MessageType.deletehistory,
  T.RPCChat.MessageType.sendpayment,
  T.RPCChat.MessageType.requestpayment,
  T.RPCChat.MessageType.flip,
  T.RPCChat.MessageType.pin,
]

beforeEach(() => {
  useConfigState.setState({loggedIn: true, userSwitching: false})
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('loadThreadNonblock', () => {
  test('defaults to an incremental server-paged general load of the whole thread', async () => {
    const rpc = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockResolvedValue({offline: true})
    await expect(loadThreadNonblock({conversationIDKey})).resolves.toEqual({offline: true})
    expect(rpc).toHaveBeenCalledWith({
      incomingCallMap: {},
      params: {
        cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
        conversationID: convID,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        knownRemotes: [],
        pagination: null,
        pgmode: T.RPCChat.GetThreadNonblockPgMode.server,
        query: {
          disablePostProcessThread: false,
          disableResolveSupersedes: false,
          enableDeletePlaceholders: true,
          markAsRead: false,
          messageIDControl: null,
          messageTypes: expect.any(Array),
        },
        reason: T.RPCChat.GetThreadReason.general,
      },
      waitingKey: undefined,
    })
    const types = [...(rpc.mock.calls[0]?.[0].params.query?.messageTypes ?? [])].sort((a, b) => a - b)
    expect(types).toEqual([...threadMessageTypes].sort((a, b) => a - b))
  })

  test('passes the caller options through', async () => {
    const rpc = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockResolvedValue({offline: false})
    const pagination = {last: false, next: 'n', num: 5, previous: ''}
    const messageIDControl = {mode: T.RPCChat.MessageIDControlMode.centered, num: 3, pivot: T.Chat.numberToMessageID(7)}
    await loadThreadNonblock({
      conversationIDKey,
      knownRemotes: ['a'],
      messageIDControl,
      pagination,
      reason: T.RPCChat.GetThreadReason.push,
      waitingKey: 'wk',
    })
    const arg = rpc.mock.calls[0]?.[0]
    expect(arg?.params.knownRemotes).toEqual(['a'])
    expect(arg?.params.pagination).toBe(pagination)
    expect(arg?.params.query?.messageIDControl).toBe(messageIDControl)
    expect(arg?.params.reason).toBe(T.RPCChat.GetThreadReason.push)
    expect(arg?.waitingKey).toBe('wk')
  })

  test('only the callbacks the caller asked for are registered, and they unwrap the payload', async () => {
    const onCachedThread = jest.fn()
    const onFullThread = jest.fn()
    const onThreadStatus = jest.fn()
    const status = {typ: T.RPCChat.UIChatThreadStatusTyp.server} as T.RPCChat.UIChatThreadStatus
    const rpc = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({thread: 'cached'} as never)
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: null} as never)
      p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({status} as never)
      return Promise.resolve({offline: false})
    })
    await loadThreadNonblock({conversationIDKey, onCachedThread, onFullThread, onThreadStatus})
    expect(onCachedThread).toHaveBeenCalledWith('cached')
    // a null thread arrives as an empty string
    expect(onFullThread).toHaveBeenCalledWith('')
    expect(onThreadStatus).toHaveBeenCalledWith(status)

    rpc.mockClear()
    await loadThreadNonblock({conversationIDKey, onFullThread})
    expect(Object.keys(rpc.mock.calls[0]?.[0].incomingCallMap ?? {})).toEqual(['chat.1.chatUi.chatThreadFull'])
  })

  test('nothing is issued while the chat session is not ready', async () => {
    const rpc = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
    useConfigState.setState({loggedIn: false})
    await expect(loadThreadNonblock({conversationIDKey})).resolves.toBeUndefined()
    useConfigState.setState({loggedIn: true, userSwitching: true})
    await expect(loadThreadNonblock({conversationIDKey})).resolves.toBeUndefined()
    expect(rpc).not.toHaveBeenCalled()
  })

  test('a service error rejects', async () => {
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockRejectedValue(new Error('offline'))
    await expect(loadThreadNonblock({conversationIDKey})).rejects.toThrow('offline')
  })
})

describe('loadThreadMessageIDAtIndex', () => {
  const thread = (ids: ReadonlyArray<number>) => JSON.stringify({messages: ids.map(messageID => ({valid: {messageID}}))})

  test('reads the id at the index from the first thread that arrives', async () => {
    let sendFull = () => {}
    const rpc = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({thread: thread([30, 20, 10])} as never)
      sendFull = () => p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: thread([31, 21, 11])} as never)
      return new Promise(() => {})
    })
    await expect(loadThreadMessageIDAtIndex(conversationIDKey, 2)).resolves.toBe(T.Chat.numberToMessageID(10))
    expect(rpc.mock.calls[0]?.[0].params.pagination).toEqual({last: false, next: '', num: 3, previous: ''})
    sendFull()
  })

  test('a second thread that lands before the caller resumes overwrites the id', async () => {
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
      p.incomingCallMap['chat.1.chatUi.chatThreadCached']?.({thread: thread([30, 20, 10])} as never)
      p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: thread([31, 21, 11])} as never)
      return Promise.resolve({offline: false})
    })
    await expect(loadThreadMessageIDAtIndex(conversationIDKey, 2)).resolves.toBe(T.Chat.numberToMessageID(11))
  })

  test('an unparseable thread, a short thread or a non-valid message give nothing', async () => {
    const cases = ['not json', thread([30]), JSON.stringify({messages: [{}, {placeholder: {messageID: 4}}]})]
    for (const t of cases) {
      jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
        p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({thread: t} as never)
        return Promise.resolve({offline: false})
      })
      await expect(loadThreadMessageIDAtIndex(conversationIDKey, 1)).resolves.toBeUndefined()
    }
  })

  test('resolves with nothing when the load fails or returns without a thread', async () => {
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockRejectedValueOnce(new Error('offline'))
    await expect(loadThreadMessageIDAtIndex(conversationIDKey, 1)).resolves.toBeUndefined()
    jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockResolvedValueOnce({offline: false})
    await expect(loadThreadMessageIDAtIndex(conversationIDKey, 1)).resolves.toBeUndefined()
  })
})

test('threadLoadReasonToRPCReason maps push-like reasons to push', () => {
  expect(threadLoadReasonToRPCReason('push')).toBe(T.RPCChat.GetThreadReason.push)
  expect(threadLoadReasonToRPCReason('extension')).toBe(T.RPCChat.GetThreadReason.push)
  expect(threadLoadReasonToRPCReason('scroll back')).toBe(T.RPCChat.GetThreadReason.general)
})

// The service adapter's translations that carry logic: defaults, derived fields, filters. The
// callers' suites drive the fake; a pure pass-through is left to the types.
describe('service adapter', () => {
  const rpc = () => getChatRpc()
  const outboxID = new Uint8Array([7, 7])
  const localOutboxID = T.Chat.rpcOutboxIDToOutboxID(outboxID)

  test('postText declines stellar confirmations and reports a canceled payment', async () => {
    const onStellarCanceled = jest.fn()
    const confirm = jest.fn()
    const dataError = jest.fn()
    const spy = jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockImplementation(async p => {
      p.customResponseIncomingCallMap?.['chat.1.chatUi.chatStellarDataConfirm']?.(
        {} as never,
        {error: jest.fn(), result: confirm} as never
      )
      p.customResponseIncomingCallMap?.['chat.1.chatUi.chatStellarDataError']?.(
        {} as never,
        {error: jest.fn(), result: dataError} as never
      )
      p.incomingCallMap['chat.1.chatUi.chatStellarShowConfirm']?.({} as never)
      p.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: false} as never)
      expect(onStellarCanceled).not.toHaveBeenCalled()
      p.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true} as never)
      return Promise.resolve({} as never)
    })
    await rpc().postText({
      clientPrev: T.Chat.numberToMessageID(5),
      conversationIDKey,
      ephemeralLifetime: 0,
      onStellarCanceled,
      replyTo: T.Chat.numberToMessageID(4),
      text: 'hi',
      tlfName: 'testuser',
      unfurlSuppress: ['https://a.com'],
    })
    expect(confirm).toHaveBeenCalledWith(false)
    expect(dataError).toHaveBeenCalledWith(false)
    expect(onStellarCanceled).toHaveBeenCalledTimes(1)
    const arg = spy.mock.calls[0]![0]
    expect(arg.params).toEqual({
      body: 'hi',
      clientPrev: 5,
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: undefined,
      replyTo: 4,
      tlfName: 'testuser',
      tlfPublic: false,
      unfurlSuppress: ['https://a.com'],
    })
    expect(arg.waitingKey).toBeUndefined()
  })

  test('postText carries a lifetime only when exploding, and an empty suppress list by default', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({} as never)
    await rpc().postText({
      clientPrev: T.Chat.numberToMessageID(0),
      conversationIDKey,
      ephemeralLifetime: 300,
      text: 'boom',
      tlfName: 'testuser',
    })
    expect(spy.mock.calls[0]![0].params).toEqual(
      expect.objectContaining({ephemeralLifetime: 300, replyTo: undefined, unfurlSuppress: []})
    )
  })

  test('postEdit targets the message and its outbox entry under a fresh outbox id', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localPostEditNonblockRpcPromise').mockResolvedValue({} as never)
    await rpc().postEdit({
      clientPrev: T.Chat.numberToMessageID(11),
      conversationIDKey,
      messageID: T.Chat.numberToMessageID(10),
      messageOutboxID: localOutboxID,
      text: 'changed',
      tlfName: 'testuser',
    })
    await rpc().postEdit({
      clientPrev: T.Chat.numberToMessageID(11),
      conversationIDKey,
      messageID: T.Chat.numberToMessageID(10),
      text: 'changed',
      tlfName: 'testuser',
    })
    expect(spy.mock.calls[0]?.[0]).toEqual({
      body: 'changed',
      clientPrev: 11,
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID: expect.any(Uint8Array),
      target: {messageID: 10, outboxID},
      tlfName: 'testuser',
      tlfPublic: false,
    })
    expect(spy.mock.calls[1]?.[0].target).toEqual({messageID: 10, outboxID: undefined})
    await rpc().postEdit({
      clientPrev: T.Chat.numberToMessageID(11),
      conversationIDKey,
      messageID: T.Chat.numberToMessageID(10),
      messageOutboxID: T.Chat.stringToOutboxID(''),
      text: 'changed',
      tlfName: 'testuser',
    })
    expect(spy.mock.calls[2]?.[0].target).toEqual({messageID: 10, outboxID: undefined})
  })

  test('postDelete supersedes the message, with a zero clientPrev by default', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localPostDeleteNonblockRpcPromise').mockResolvedValue({} as never)
    await rpc().postDelete({conversationIDKey, messageID: T.Chat.numberToMessageID(10), tlfName: 'testuser'})
    await rpc().postDelete({
      clientPrev: T.Chat.numberToMessageID(3),
      conversationIDKey,
      messageID: T.Chat.numberToMessageID(10),
      tlfName: 'testuser',
    })
    expect(spy.mock.calls).toEqual([
      [
        {
          clientPrev: 0,
          conversationID: convID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          outboxID: null,
          supersedes: 10,
          tlfName: 'testuser',
          tlfPublic: false,
        },
      ],
      [expect.objectContaining({clientPrev: 3})],
    ])
  })

  test('postReaction keeps a given outbox id and makes one otherwise', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localPostReactionNonblockRpcPromise').mockResolvedValue({} as never)
    await rpc().postReaction({
      clientPrev: T.Chat.numberToMessageID(12),
      conversationIDKey,
      emoji: ':+1:',
      messageID: T.Chat.numberToMessageID(10),
      outboxID,
      tlfName: 'testuser',
    })
    await rpc().postReaction({
      clientPrev: T.Chat.numberToMessageID(12),
      conversationIDKey,
      emoji: ':+1:',
      messageID: T.Chat.numberToMessageID(10),
      tlfName: 'testuser',
    })
    expect(spy.mock.calls[0]?.[0]).toEqual({
      body: ':+1:',
      clientPrev: 12,
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      outboxID,
      supersedes: 10,
      tlfName: 'testuser',
      tlfPublic: false,
    })
    expect(spy.mock.calls[1]?.[0].outboxID).toEqual(expect.any(Uint8Array))
  })

  test('postAttachment sends a private file post, with the lifetime and preview only when given', async () => {
    const spy = jest
      .spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
      .mockResolvedValue({} as never)
    const callerPreview = {mimeType: 'image/png'} as T.RPCChat.MakePreviewRes
    await rpc().postAttachment({
      clientPrev: T.Chat.numberToMessageID(7),
      conversationIDKey,
      ephemeralLifetime: 0,
      filename: '/a.png',
      outboxID,
      title: 'first',
      tlfName: 'testuser',
    })
    await rpc().postAttachment({
      callerPreview,
      clientPrev: T.Chat.numberToMessageID(7),
      conversationIDKey,
      ephemeralLifetime: 60,
      filename: '/a.m4a',
      outboxID,
      title: '',
      tlfName: 'testuser',
    })
    expect(spy.mock.calls[0]?.[0]).toEqual({
      arg: {
        conversationID: convID,
        filename: '/a.png',
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        metadata: new Uint8Array(),
        outboxID,
        title: 'first',
        tlfName: 'testuser',
        visibility: T.RPCGen.TLFVisibility.private,
      },
      clientPrev: 7,
    })
    expect(spy.mock.calls[1]?.[0].arg).toEqual(expect.objectContaining({callerPreview, ephemeralLifetime: 60}))
  })

  test('createAdhocConversation makes a private implicit-team chat of the distinct users', async () => {
    const res = {conv: {}, uiConv: {}} as T.RPCChat.NewConversationLocalRes
    const spy = jest.spyOn(T.RPCChat, 'localNewConversationLocalRpcPromise').mockResolvedValue(res)
    await expect(rpc().createAdhocConversation(['testuser', 'testuser2', 'testuser'], 'wk')).resolves.toBe(res)
    expect(spy).toHaveBeenCalledWith(
      {
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        membersType: T.RPCChat.ConversationMembersType.impteamnative,
        tlfName: 'testuser,testuser2',
        tlfVisibility: T.RPCGen.TLFVisibility.private,
        topicType: T.RPCChat.TopicType.chat,
      },
      'wk'
    )
  })

  test('getNextAttachment asks for images and videos and unwraps the message', async () => {
    const message = {state: T.RPCChat.MessageUnboxedState.valid} as T.RPCChat.UIMessage
    const spy = jest
      .spyOn(T.RPCChat, 'localGetNextAttachmentMessageLocalRpcPromise')
      .mockResolvedValueOnce({message, offline: false})
      .mockResolvedValueOnce({message: null, offline: false})
    const p = {backInTime: true, conversationIDKey, messageID: T.Chat.numberToMessageID(42)}
    await expect(rpc().getNextAttachment(p)).resolves.toBe(message)
    await expect(rpc().getNextAttachment(p)).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalledWith({
      assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
      backInTime: true,
      convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      messageID: 42,
    })
  })

  test('exploding mode is the per-conversation gregor category', async () => {
    const update = jest.spyOn(T.RPCGen, 'gregorUpdateCategoryRpcPromise').mockResolvedValue(new Uint8Array())
    const dismiss = jest.spyOn(T.RPCGen, 'gregorDismissCategoryRpcPromise').mockResolvedValue(undefined)
    await rpc().setExplodingMode(conversationIDKey, 300)
    await rpc().clearExplodingMode(conversationIDKey)
    expect(update).toHaveBeenCalledWith({
      body: '300',
      category: `exploding:${conversationIDKey}`,
      dtime: {offset: 0, time: 0},
    })
    expect(dismiss).toHaveBeenCalledWith({category: `exploding:${conversationIDKey}`})
  })
})
