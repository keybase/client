/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {
  loadThreadMessageIDAtIndex,
  loadThreadNonblock,
  markConversationRead,
  threadLoadReasonToRPCReason,
} from './thread-rpc'

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

test('markConversationRead sends the read position', async () => {
  const rpc = jest.spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise').mockResolvedValue({offline: false})
  await markConversationRead({conversationIDKey, forceUnread: true, msgID: T.Chat.numberToMessageID(9)})
  expect(rpc).toHaveBeenCalledWith({conversationID: convID, forceUnread: true, msgID: 9})
  await markConversationRead({conversationIDKey, forceUnread: false})
  expect(rpc).toHaveBeenLastCalledWith({conversationID: convID, forceUnread: false, msgID: undefined})
})

test('threadLoadReasonToRPCReason maps push-like reasons to push', () => {
  expect(threadLoadReasonToRPCReason('push')).toBe(T.RPCChat.GetThreadReason.push)
  expect(threadLoadReasonToRPCReason('extension')).toBe(T.RPCChat.GetThreadReason.push)
  expect(threadLoadReasonToRPCReason('scroll back')).toBe(T.RPCChat.GetThreadReason.general)
})
