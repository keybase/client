/// <reference types="jest" />
// markConversationUnread, the one mark unread behind the thread popup, the storeless popup, the
// info panel and the inbox swipe.
import * as Meta from '@/constants/chat/meta'
import * as OrangeLine from './orange-line-context'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import logger from '@/logger'
import {makeMessageText} from '@/constants/chat/message'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {markConversationUnread, type MarkUnreadThread} from './mark-unread'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const messageID = (n: number) => T.Chat.numberToMessageID(n)

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

let rpc: FakeChatRpc
let setOrangeLine: jest.SpyInstance
const markReads = () => rpc.params('markRead')
const loads = () => rpc.params('loadThread')
const marked = (n: number) => [{conversationIDKey, forceUnread: true, msgID: messageID(n)}]

const placeholders = (ids: ReadonlyArray<number>) =>
  JSON.stringify({
    messages: ids.map(id => ({
      placeholder: {hidden: false, messageID: messageID(id)},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    })),
  })

// the service's answer to the load around the line, one pass each
const aroundLine = (...passes: ReadonlyArray<ReadonlyArray<number>>) => {
  rpc.on('loadThread', async p => {
    await Promise.resolve()
    const [cached, full] = passes
    if (cached) p.onCachedThread?.(placeholders(cached))
    if (full) p.onFullThread?.(placeholders(full))
    return {offline: false}
  })
}

const textAt = (n: number, over?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    conversationIDKey,
    id: messageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    ...over,
  })

const threadOf = (messages: ReadonlyArray<T.Chat.Message>, retired = () => false): MarkUnreadThread => ({
  getWindow: () => ({
    messageMap: new Map(messages.map(m => [m.ordinal, m])),
    messageOrdinals: messages.map(m => m.ordinal),
  }),
  isRetired: retired,
})

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  rpc = installFakeChatRpc()
  setOrangeLine = jest.spyOn(OrangeLine, 'setConversationOrangeLine').mockImplementation(() => {})
  metasReceived(
    [{...Meta.makeConversationMeta(), conversationIDKey, maxVisibleMsgID: messageID(9)}],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('without a thread', () => {
  test('marks read at the newest message older than the line, loaded around it', async () => {
    aroundLine([3, 4, 5, 6])
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(loads()).toEqual([
      {
        conversationIDKey,
        messageIDControl: {mode: T.RPCChat.MessageIDControlMode.centered, num: 3, pivot: messageID(5)},
        onCachedThread: expect.any(Function),
        onFullThread: expect.any(Function),
        pagination: null,
      },
    ])
    expect(markReads()).toEqual(marked(4))
    expect(setOrangeLine).toHaveBeenCalledWith(conversationIDKey, T.Chat.numberToOrdinal(5))
  })

  test('no message given: the line is the newest visible message', async () => {
    aroundLine([7, 8, 9])
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(setOrangeLine).toHaveBeenCalledWith(conversationIDKey, T.Chat.numberToOrdinal(9))
    expect(markReads()).toEqual(marked(8))
  })

  test('the newest older id across both passes', async () => {
    aroundLine([6, 4], [4, 5])
    markConversationUnread(conversationIDKey, messageID(6))
    await flushPromises()
    expect(markReads()).toEqual(marked(5))
  })

  test('nothing older known marks nothing and draws no line: the line is first, or the load failed', async () => {
    aroundLine([5, 6, 7])
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    rpc.fail('loadThread', new Error('offline'))
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(markReads()).toEqual([])
    expect(setOrangeLine).not.toHaveBeenCalled()
  })

  test('a mark read the service refuses draws no line', async () => {
    aroundLine([3, 4, 5])
    rpc.fail('markRead', new Error('offline'))
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(markReads()).toEqual(marked(4))
    expect(setOrangeLine).not.toHaveBeenCalled()
  })

  test('with no meta (a row drawn from the layout) the line is the newest message loaded', async () => {
    resetAllStores()
    useConfigState.setState({loggedIn: true})
    aroundLine([7, 8], [6, 8])
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(loads()).toEqual([
      {
        conversationIDKey,
        onCachedThread: expect.any(Function),
        onFullThread: expect.any(Function),
        pagination: {last: false, next: '', num: 2, previous: ''},
      },
    ])
    expect(setOrangeLine).toHaveBeenCalledWith(conversationIDKey, T.Chat.numberToOrdinal(8))
    expect(markReads()).toEqual(marked(7))
  })

  test('a placeholder meta (no visible message known) loads the newest messages, never a pivot at -1', async () => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey}], undefined, {force: true})
    aroundLine([7, 8])
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(loads()).toEqual([expect.objectContaining({pagination: {last: false, next: '', num: 2, previous: ''}})])
    expect(loads()[0]).not.toHaveProperty('messageIDControl')
    expect(markReads()).toEqual(marked(7))
  })

  test('a conversation with one message, or none, marks nothing', async () => {
    resetAllStores()
    useConfigState.setState({loggedIn: true})
    aroundLine([8])
    markConversationUnread(conversationIDKey)
    await flushPromises()
    aroundLine([])
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(loads()).toHaveLength(2)
    expect(markReads()).toEqual([])
  })

  test('an invalid conversation or signed out does nothing', async () => {
    aroundLine([3, 4])
    markConversationUnread(T.Chat.noConversationIDKey, messageID(5))
    markConversationUnread(T.Chat.noConversationIDKey)
    useConfigState.setState({loggedIn: false})
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(loads()).toEqual([])
    expect(markReads()).toEqual([])
  })
})

describe('with a thread', () => {
  test('a window holding the line and a message below it answers with no load; the line is drawn at its row', async () => {
    const line = textAt(8, {ordinal: T.Chat.numberToOrdinal(7.5)})
    markConversationUnread(conversationIDKey, messageID(8), threadOf([textAt(3), textAt(5), line]))
    await flushPromises()
    expect(loads()).toEqual([])
    expect(markReads()).toEqual(marked(5))
    expect(setOrangeLine).toHaveBeenCalledWith(conversationIDKey, T.Chat.numberToOrdinal(7.5))
  })

  test('an unsent row is not a read position', async () => {
    const unsent = textAt(7, {id: messageID(0), outboxID: T.Chat.stringToOutboxID('o1'), submitState: 'pending'})
    markConversationUnread(conversationIDKey, messageID(8), threadOf([textAt(3), unsent, textAt(8)]))
    await flushPromises()
    expect(markReads()).toEqual(marked(3))
  })

  test('a window that does not reach the line asks the service', async () => {
    aroundLine([7, 8, 9])
    markConversationUnread(conversationIDKey, undefined, threadOf([textAt(3), textAt(5)]))
    await flushPromises()
    expect(loads()).toHaveLength(1)
    expect(markReads()).toEqual(marked(8))
  })

  test('a window whose oldest row is the line asks the service', async () => {
    aroundLine([4, 5])
    markConversationUnread(conversationIDKey, messageID(5), threadOf([textAt(5), textAt(6)]))
    await flushPromises()
    expect(markReads()).toEqual(marked(4))
  })

  test('a thread that retired while the mark read was on its way draws no line', async () => {
    rpc.on('markRead', async () => {
      retired = true
      await Promise.resolve()
    })
    let retired = false
    markConversationUnread(conversationIDKey, messageID(8), threadOf([textAt(5), textAt(8)], () => retired))
    await flushPromises()
    expect(markReads()).toEqual(marked(5))
    expect(setOrangeLine).not.toHaveBeenCalled()
  })

  test('a thread that retired while the service answered marks nothing', async () => {
    aroundLine([4, 5])
    let retired = false
    markConversationUnread(conversationIDKey, messageID(5), threadOf([], () => retired))
    retired = true
    await flushPromises()
    expect(loads()).toHaveLength(1)
    expect(markReads()).toEqual([])
    expect(setOrangeLine).not.toHaveBeenCalled()
  })
})
