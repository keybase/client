/// <reference types="jest" />
// markConversationUnread, the one mark unread behind the thread popup, the storeless popup, the
// info panel and the inbox swipe.
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import logger from '@/logger'
import {makeMessageText} from '@/constants/chat/message'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {answerThreadLoads, getThreadNonblock, holdHandlerTimers, paramsOf, threadLoaded} from '@/test/fake-thread-load'
import {settle} from '@/test/flush'
import {useExplicitOrangeLineState} from './orange-line-context'
import {makeThreadChatRpc} from './chat-rpc'
import {markConversationUnread, type MarkUnreadThread} from './mark-unread'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const messageID = (n: number) => T.Chat.numberToMessageID(n)

const markAsRead = 'chat.1.local.markAsReadLocal'
const conversationID = T.Chat.keyToConversationID(conversationIDKey)

// a mark unread is a load or two, then a mark read, each a round trip to the service
const flushPromises = async () => settle(4)

let fake: FakeEngine
const markReads = () => paramsOf(fake, markAsRead)
const loads = () => paramsOf(fake, getThreadNonblock)
const marked = (n: number) => [{conversationID, forceUnread: true, msgID: messageID(n)}]
// the orange line drawn for the conversation, if any
const orangeLine = () => useExplicitOrangeLineState.getState().updates.get(conversationIDKey)?.ordinal

const placeholders = (ids: ReadonlyArray<number>) =>
  JSON.stringify({
    messages: ids.map(id => ({
      placeholder: {hidden: false, messageID: messageID(id)},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    })),
  })

// The service's answer to the load around the line, one pass each. It replies only once its passes
// have reached their handlers (the listener runs them on a timer after acking), as a service slow
// to finish the load does; replying at once is covered below.
const aroundLine = (...passes: ReadonlyArray<ReadonlyArray<number>>) => {
  answerThreadLoads(fake, async l => {
    const [cached, full] = passes
    if (cached) await l.cached(placeholders(cached))
    if (full) await l.full(placeholders(full))
    await settle()
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
  rpc: makeThreadChatRpc(retired),
})

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  fake = installFakeEngine()
  fake.answer(markAsRead, () => undefined)
  metasReceived(
    [{...Meta.makeConversationMeta(), conversationIDKey, maxVisibleMsgID: messageID(9)}],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('without a thread', () => {
  test('marks read at the newest message older than the line, loaded around it', async () => {
    aroundLine([3, 4, 5, 6])
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(loads()).toEqual([
      expect.objectContaining({
        conversationID,
        pagination: null,
        query: expect.objectContaining({
          messageIDControl: {mode: T.RPCChat.MessageIDControlMode.centered, num: 3, pivot: messageID(5)},
        }),
      }),
    ])
    expect(markReads()).toEqual(marked(4))
    expect(orangeLine()).toBe(T.Chat.numberToOrdinal(5))
  })

  test('no message given: the line is the newest visible message', async () => {
    aroundLine([7, 8, 9])
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(orangeLine()).toBe(T.Chat.numberToOrdinal(9))
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
    answerThreadLoads(fake, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(markReads()).toEqual([])
    expect(orangeLine()).toBeUndefined()
  })

  // loadConversationMessageIDs collects ids from the passes and reads them as soon as loadThread
  // resolves. The session acks each pass at once and the listener runs its handler on a timer, so
  // the service can reply before the last pass is read; loadThread still waits for it.
  test('marks even when the service replies right after its last pass', async () => {
    answerThreadLoads(fake, async l => {
      const timers = holdHandlerTimers()
      await l.full(placeholders([3, 4, 5, 6]))
      return timers.replyFirst(threadLoaded)
    })
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(markReads()).toEqual(marked(4))
  })

  test('a mark read the service refuses draws no line', async () => {
    aroundLine([3, 4, 5])
    fake.answer(markAsRead, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    markConversationUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(markReads()).toEqual(marked(4))
    expect(orangeLine()).toBeUndefined()
  })

  test('with no meta (a row drawn from the layout) the line is the newest message loaded', async () => {
    resetAllStores()
    useConfigState.setState({loggedIn: true})
    aroundLine([7, 8], [6, 8])
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(loads()).toEqual([
      expect.objectContaining({
        conversationID,
        pagination: {last: false, next: '', num: 2, previous: ''},
        query: expect.objectContaining({messageIDControl: null}),
      }),
    ])
    expect(orangeLine()).toBe(T.Chat.numberToOrdinal(8))
    expect(markReads()).toEqual(marked(7))
  })

  test('a placeholder meta (no visible message known) loads the newest messages, never a pivot at -1', async () => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey}], undefined, {force: true})
    aroundLine([7, 8])
    markConversationUnread(conversationIDKey)
    await flushPromises()
    expect(loads()).toEqual([expect.objectContaining({pagination: {last: false, next: '', num: 2, previous: ''}})])
    expect(loads()[0].query.messageIDControl).toBeNull()
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
    expect(orangeLine()).toBe(T.Chat.numberToOrdinal(7.5))
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

  test('a thread that has retired asks the service nothing', async () => {
    aroundLine([4, 5])
    markConversationUnread(conversationIDKey, messageID(5), threadOf([], () => true))
    await flushPromises()
    expect(loads()).toEqual([])
    expect(markReads()).toEqual([])
  })

  test('a thread that retired while the mark read was on its way draws no line', async () => {
    fake.answer(markAsRead, () => {
      retired = true
    })
    let retired = false
    markConversationUnread(conversationIDKey, messageID(8), threadOf([textAt(5), textAt(8)], () => retired))
    await flushPromises()
    expect(markReads()).toEqual(marked(5))
    expect(orangeLine()).toBeUndefined()
  })

  test('a thread that retired while the service answered marks nothing', async () => {
    aroundLine([4, 5])
    let retired = false
    markConversationUnread(conversationIDKey, messageID(5), threadOf([], () => retired))
    retired = true
    await flushPromises()
    expect(loads()).toHaveLength(1)
    expect(markReads()).toEqual([])
    expect(orangeLine()).toBeUndefined()
  })
})
