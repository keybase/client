/// <reference types="jest" />
// makeThreadStore on its own: no provider, no React. The service is the fake engine behind the real
// chat adapter; the session and conversation meta are the real stores.
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import logger from '@/logger'
import {makeMessageAttachment, makeMessageDeleted, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {answerThreadLoads, getThreadNonblock, holdHandlerTimers, paramsOf, threadLoaded, threadLoadOf} from '@/test/fake-thread-load'
import {settle, tick} from '@/test/flush'
import {deleteMessage, dismissJourneycard, replyPrivately, toggleCollapse, toggleReaction} from './message-commands'
import {makeThreadStore, type ConversationThreadActions, type LoadMoreMessagesParams} from './thread-store'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

let fake: FakeEngine

const setSession = (session: {loggedIn: boolean; uid: string}) => {
  useConfigState.setState({loggedIn: session.loggedIn})
  useCurrentUserState.setState({uid: session.uid})
}

const setMeta = (id: T.Chat.ConversationIDKey, over: Partial<T.Chat.ConversationMeta>) => {
  metasReceived(
    [
      {
        ...Meta.makeConversationMeta(),
        conversationIDKey: id,
        maxVisibleMsgID: T.Chat.numberToMessageID(20),
        readMsgID: T.Chat.numberToMessageID(0),
        ...over,
      },
    ],
    undefined,
    {force: true}
  )
}

const textAt = (n: number, over?: Partial<T.Chat.MessageText>, id = convA) =>
  makeMessageText({
    author: 'testuser2',
    conversationIDKey: id,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    ...over,
  })

// a round trip to the service, and a load's streams reaching their handlers
const flushPromises = async () => settle(3)

// what the store asked has crossed to the service; real hops, so this works under fake timers too
const sent = async () => {
  await tick()
  await tick()
}

const markAsRead = 'chat.1.local.markAsReadLocal'
const retryPost = 'chat.1.local.RetryPost'
const updateCategory = 'keybase.1.gregor.updateCategory'
const dismissCategory = 'keybase.1.gregor.dismissCategory'

const placeholders = (ids: ReadonlyArray<number>) =>
  JSON.stringify({
    messages: ids.map(id => ({
      placeholder: {hidden: false, messageID: T.Chat.numberToMessageID(id)},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    })),
  })

// whether the reader is looking at the thread, as the provider reports it when asked
let looking = true
const makeThread = (id = convA) => makeThreadStore(id, useCurrentUserState.getState().uid, () => looking)

const arm = (actions: ConversationThreadActions, messages: ReadonlyArray<T.Chat.Message>) =>
  actions.applyThreadLoad({
    centered: false,
    enableActiveMarkRead: true,
    messages,
    moreToLoad: false,
    scrollDirection: 'none',
  })

type MarkAsReadParams = {conversationID: Uint8Array; forceUnread: boolean; msgID: T.Chat.MessageID}
type ThreadLoadParams = {
  conversationID: Uint8Array
  knownRemotes: ReadonlyArray<string>
  pagination: T.RPCChat.UIPagination | null
}
const markReads = () =>
  paramsOf(fake, markAsRead).map(({conversationID, forceUnread, msgID}: MarkAsReadParams) => ({
    conversationIDKey: T.Chat.conversationIDToKey(conversationID),
    forceUnread,
    msgID,
  }))
const loads = () =>
  paramsOf(fake, getThreadNonblock).map(({conversationID, knownRemotes, pagination}: ThreadLoadParams) => ({
    conversationIDKey: T.Chat.conversationIDToKey(conversationID),
    knownRemotes,
    pagination,
  }))

beforeEach(() => {
  looking = true
  fake = installFakeEngine()
  answerThreadLoads(fake)
  fake.answer(markAsRead, () => undefined)
  fake.answer(retryPost, () => undefined)
  fake.answer(updateCategory, () => new Uint8Array([9]))
  fake.answer(dismissCategory, () => undefined)
  setSession({loggedIn: true, uid: 'uid'})
  setMeta(convA, {})
  setMeta(convB, {})
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
  resetAllStores()
})

describe('a new store', () => {
  test('starts empty and unloaded', () => {
    const {shownUsernameCache, store} = makeThread()
    const s = store.getState()
    expect(s.loaded).toBe(false)
    expect(s.messageOrdinals).toBeUndefined()
    expect([s.messageMap.size, s.typing.size, s.clearVersion, s.liveUpdateVersion]).toEqual([0, 0, 0, 0])
    expect([s.moreToLoadBack, s.moreToLoadForward, s.windowCleared]).toEqual([false, false, undefined])
    expect(shownUsernameCache.size).toBe(0)
  })

  test('takes its exploding mode from gregor for its own conversation', () => {
    useConfigState.setState({
      gregorPushState: [
        {item: {body: new TextEncoder().encode('86400'), category: `exploding:${convA}`}},
      ] as unknown as ReturnType<typeof useConfigState.getState>['gregorPushState'],
    })
    expect(makeThread(convA).store.getState().explodingMode).toBe(86400)
    expect(makeThread(convB).store.getState().explodingMode).toBe(0)
  })

  test('getSnapshot is the store state', () => {
    const {actions, store} = makeThread()
    actions.addMessages([textAt(1)])
    expect(actions.getSnapshot()).toBe(store.getState())
  })
})

describe('mark read', () => {
  test('marks at the newest message with an id once armed and looked at', async () => {
    const {actions} = makeThread()
    arm(actions, [textAt(5), textAt(6), textAt(7, {id: T.Chat.numberToMessageID(0)})])
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: false, msgID: 6}])
  })

  test('a store whose reader is not looking refuses', async () => {
    const {actions} = makeThreadStore(convA, useCurrentUserState.getState().uid, () => false)
    arm(actions, [textAt(5)])
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
  })

  test('a mark read already on its way is not sent again; once it lands the next one goes', async () => {
    const {actions} = makeThread()
    arm(actions, [textAt(5)])
    actions.markThreadAsRead()
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toHaveLength(1)
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toHaveLength(2)
  })

  test('looking away refuses, looking back does not mark on its own', async () => {
    const thread = makeThread()
    arm(thread.actions, [textAt(5)])
    looking = false
    thread.actions.markThreadAsRead()
    looking = true
    await flushPromises()
    expect(markReads()).toEqual([])
    thread.actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toHaveLength(1)
  })

  test('markReadIfArmed marks only when a load armed it, without even trying before', async () => {
    const info = jest.spyOn(logger, 'info')
    const thread = makeThread()
    thread.actions.addMessages([textAt(5)])
    thread.markReadIfArmed()
    await flushPromises()
    expect(markReads()).toEqual([])
    expect(info).not.toHaveBeenCalledWith('mark read bail on no eligible thread load')
    arm(thread.actions, [textAt(6)])
    thread.markReadIfArmed()
    await flushPromises()
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: false, msgID: 6}])
  })

  test('the session is read at call time; the account is the one at creation', async () => {
    const {actions} = makeThread()
    arm(actions, [textAt(5)])
    setSession({loggedIn: false, uid: 'uid'})
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
    setSession({loggedIn: true, uid: 'uid'})
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toHaveLength(1)
    // another account retires the store for good
    setSession({loggedIn: true, uid: 'uid-2'})
    actions.markThreadAsRead()
    setSession({loggedIn: true, uid: 'uid'})
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toHaveLength(1)
  })

  test('a store made for the second account marks for it', async () => {
    setSession({loggedIn: true, uid: 'uid-2'})
    const {actions} = makeThread()
    arm(actions, [textAt(5)])
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toHaveLength(1)
  })

  test('meta decides: no meta or unlocalized waits, a read position already there is a no-op', async () => {
    const {actions} = makeThread()
    arm(actions, [textAt(5)])
    useInboxMetadataState.setState(s => ({metas: new Map([...s.metas].filter(([id]) => id !== convA))}))
    actions.markThreadAsRead()
    setMeta(convA, {readMsgID: T.Chat.numberToMessageID(-1)})
    actions.markThreadAsRead()
    setMeta(convA, {readMsgID: T.Chat.numberToMessageID(5)})
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
    setMeta(convA, {readMsgID: T.Chat.numberToMessageID(4)})
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: false, msgID: 5}])
  })

  test('an invalid conversation never marks', async () => {
    const {actions} = makeThread(T.Chat.noConversationIDKey)
    arm(actions, [textAt(5, undefined, T.Chat.noConversationIDKey)])
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
  })

  test('unloaded, cleared or short of the latest refuses', async () => {
    const {actions} = makeThread()
    actions.setMarkReadBlocked(false)
    actions.markThreadAsRead()
    arm(actions, [textAt(5)])
    actions.messagesClear()
    actions.markThreadAsRead()
    actions.applyThreadLoad({
      centered: true,
      enableActiveMarkRead: true,
      messages: [textAt(6)],
      moreToLoad: false,
      scrollDirection: 'none',
    })
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
  })

  test('blocking disarms; a forward page to the bottom lifts the block but does not re-arm by itself', async () => {
    const {actions} = makeThread()
    arm(actions, [textAt(5)])
    actions.setMarkReadBlocked(true)
    arm(actions, [textAt(6)])
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
    actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(7)],
      moreToLoad: false,
      scrollDirection: 'forward',
    })
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
    arm(actions, [textAt(8)])
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: false, msgID: 8}])
  })

  test('disableActiveMarkRead wins over enableActiveMarkRead', async () => {
    const {actions} = makeThread()
    arm(actions, [textAt(5)])
    actions.applyThreadLoad({
      centered: false,
      disableActiveMarkRead: true,
      enableActiveMarkRead: true,
      messages: [textAt(6)],
      moreToLoad: false,
      scrollDirection: 'none',
    })
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
  })

  test('addMessages with markAsRead and an updateReactions that found a target ask to mark', async () => {
    const {actions} = makeThread()
    arm(actions, [textAt(5)])
    actions.addMessages([textAt(6)], {markAsRead: true})
    await flushPromises()
    actions.updateReactions([])
    actions.updateReactions([{targetMsgID: T.Chat.numberToMessageID(9)}])
    await flushPromises()
    expect(markReads().map(p => p.msgID)).toEqual([6])
    actions.updateReactions([{reactions: new Map(), targetMsgID: T.Chat.numberToMessageID(6)}])
    await flushPromises()
    expect(markReads().map(p => p.msgID)).toEqual([6, 6])
  })
})

describe('setMarkAsUnread', () => {
  test('marks unread from the newest loaded message below the line', async () => {
    const {actions} = makeThread()
    actions.addMessages([textAt(3), textAt(5), textAt(8)])
    actions.setMarkAsUnread(T.Chat.numberToMessageID(8))
    await flushPromises()
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: true, msgID: 5}])
  })

  test('no read position takes the line from the conversation meta', async () => {
    setMeta(convA, {maxVisibleMsgID: T.Chat.numberToMessageID(6)})
    const {actions} = makeThread()
    actions.addMessages([textAt(3), textAt(5), textAt(8)])
    actions.setMarkAsUnread()
    await flushPromises()
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: true, msgID: 5}])
  })

  test('a window that does not reach the line asks the service for the message before it', async () => {
    // a search jump left the window far below the newest visible message
    setMeta(convA, {maxVisibleMsgID: T.Chat.numberToMessageID(20)})
    // The service replies once the pass has reached its handler (replying at once is covered in
    // mark-unread.test.tsx)
    answerThreadLoads(fake, async l => {
      const valid = (messageID: number) => ({state: T.RPCChat.MessageUnboxedState.valid, valid: {messageID}})
      await l.full(JSON.stringify({messages: [valid(19), valid(20)]}))
      await settle()
    })
    const {actions} = makeThread()
    actions.addMessages([textAt(3), textAt(5)])
    actions.setMarkAsUnread()
    await flushPromises()
    expect(loads()).toHaveLength(1)
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: true, msgID: 19}])
  })

  test('an unsent row below the line is passed over', async () => {
    const {actions} = makeThread()
    actions.addMessages([
      textAt(3),
      textAt(8),
      textAt(9, {id: T.Chat.numberToMessageID(0), outboxID: T.Chat.stringToOutboxID('o1'), submitState: 'pending'}),
    ])
    actions.setMarkAsUnread(T.Chat.numberToMessageID(8))
    await flushPromises()
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: true, msgID: 3}])
  })

  test('logged out, it does nothing', async () => {
    const {actions} = makeThread()
    actions.addMessages([textAt(3), textAt(8)])
    useConfigState.setState({loggedIn: false})
    actions.setMarkAsUnread(T.Chat.numberToMessageID(8))
    await flushPromises()
    expect(markReads()).toEqual([])
  })
})

describe('loadMoreMessages', () => {
  const scroll = (n: number): LoadMoreMessagesParams => ({
    numberOfMessagesToLoad: n,
    reason: 'scroll back',
    scrollDirection: 'back',
  })

  test('asks the service for its conversation and the window the load names', async () => {
    const {actions} = makeThread()
    actions.loadMoreMessages(scroll(1))
    await sent()
    expect(loads()).toEqual([
      expect.objectContaining({conversationIDKey: convA, pagination: expect.objectContaining({num: 1})}),
    ])
  })

  test('throttles to the first and last call in 500ms', async () => {
    jest.useFakeTimers()
    const {actions} = makeThread()
    actions.loadMoreMessages(scroll(1))
    actions.loadMoreMessages(scroll(2))
    actions.loadMoreMessages(scroll(3))
    jest.advanceTimersByTime(499)
    await sent()
    expect(loads().map(l => l.pagination?.num)).toEqual([1])
    jest.advanceTimersByTime(1)
    await sent()
    expect(loads().map(l => l.pagination?.num)).toEqual([1, 3])
  })

  // knownRemotes marks the load under test in what the service is asked
  test.each<[string, LoadMoreMessagesParams]>([
    [
      'a centered load',
      {
        centeredMessageID: {conversationIDKey: convA, highlightMode: 'flash', messageID: T.Chat.numberToMessageID(1)},
        knownRemotes: ['p'],
        reason: 'centered',
      },
    ],
    [
      'a message-id load',
      {
        knownRemotes: ['p'],
        messageIDControl: {
          mode: T.RPCChat.MessageIDControlMode.newermessages,
          num: 5,
          pivot: T.Chat.numberToMessageID(1),
        },
        reason: 'x',
      },
    ],
    ['jump to recent', {knownRemotes: ['p'], reason: 'jump to recent'}],
  ])('%s runs at once and drops the pending call', async (_, p) => {
    jest.useFakeTimers()
    const {actions} = makeThread()
    actions.loadMoreMessages(scroll(1))
    actions.loadMoreMessages(scroll(2))
    actions.loadMoreMessages(p)
    await sent()
    expect(loads().map(l => l.knownRemotes)).toEqual([[], ['p']])
    jest.advanceTimersByTime(1000)
    await sent()
    expect(loads()).toHaveLength(2)
  })

  test('dispose drops the pending call and leaves the store working', async () => {
    jest.useFakeTimers()
    const thread = makeThread()
    thread.actions.loadMoreMessages(scroll(1))
    thread.actions.loadMoreMessages(scroll(2))
    thread.dispose()
    jest.advanceTimersByTime(1000)
    await sent()
    expect(loads()).toHaveLength(1)
    thread.dispose()
    thread.actions.loadMoreMessages(scroll(3))
    thread.actions.addMessages([textAt(1)])
    await sent()
    expect(loads().map(l => l.pagination?.num)).toEqual([1, 3])
    expect(thread.store.getState().messageOrdinals).toEqual([1])
  })
})

describe('the reload a clear issues', () => {
  // Whether the window gate ever came down while the cleared window was still empty: a notification
  // arriving then installs itself as the whole window.
  const watchGate = (store: ReturnType<typeof makeThread>['store']) => {
    const gaps: Array<boolean> = []
    store.subscribe(s => {
      if (!s.windowCleared && s.messageOrdinals === undefined) {
        gaps.push(true)
      }
    })
    return gaps
  }

  test('a service slow to reply refills the window before the gate comes down', async () => {
    answerThreadLoads(fake, async l => {
      await l.full(placeholders([50, 51]))
      await settle()
    })
    const {actions, store} = makeThread()
    arm(actions, [textAt(5)])
    actions.messagesClear()
    const gaps = watchGate(store)
    actions.loadMoreMessages({reason: 'jump to recent'})
    await flushPromises()
    expect(store.getState().messageOrdinals).toEqual([50, 51])
    expect(store.getState().windowCleared).toBe(false)
    expect(gaps).toEqual([])
  })

  // The load releases the gate in its finally, once loadThread resolves. The session acks the full
  // pass at once and the listener applies it on a timer, so the service can reply before that;
  // loadThread still resolves only after the pass is applied, so the gate never comes down over an
  // empty window.
  test('a service that replies right after its full pass keeps the gate up until the page lands', async () => {
    answerThreadLoads(fake, async l => {
      const timers = holdHandlerTimers()
      await l.full(placeholders([50, 51]))
      return timers.replyFirst(threadLoaded)
    })
    const {actions, store} = makeThread()
    arm(actions, [textAt(5)])
    actions.messagesClear()
    const gaps = watchGate(store)
    actions.loadMoreMessages({reason: 'jump to recent'})
    await flushPromises()
    expect(store.getState().messageOrdinals).toEqual([50, 51])
    expect(gaps).toEqual([])
  })
})

describe('applyThreadLoad', () => {
  const base = {centered: false, enableActiveMarkRead: false, moreToLoad: false, scrollDirection: 'none' as const}

  test('marks loaded and sets the direction flags', () => {
    const {actions, store} = makeThread()
    actions.applyThreadLoad({...base, messages: [textAt(5)], moreToLoad: true})
    expect([store.getState().loaded, store.getState().moreToLoadBack]).toEqual([true, true])
    actions.applyThreadLoad({...base, messages: [textAt(6)], moreToLoad: true, scrollDirection: 'forward'})
    expect(store.getState().moreToLoadForward).toBe(true)
    actions.applyThreadLoad({...base, messages: [textAt(4)], scrollDirection: 'back'})
    expect(store.getState().moreToLoadBack).toBe(false)
    expect(store.getState().messageOrdinals).toEqual([4, 5, 6])
  })

  test('the contains-latest check reads maxVisibleMsgID through the meta dep', () => {
    const a = makeThread()
    a.actions.applyThreadLoad({...base, centered: true, forceContainsLatestCalc: true, messages: [textAt(20)]})
    expect(a.store.getState().moreToLoadForward).toBe(false)
    setMeta(convA, {maxVisibleMsgID: T.Chat.numberToMessageID(0)})
    const b = makeThread()
    b.actions.applyThreadLoad({...base, centered: true, forceContainsLatestCalc: true, messages: [textAt(20)]})
    expect(b.store.getState().moreToLoadForward).toBe(true)
  })

  test('a newest page disjoint from a window short of the latest is ignored', () => {
    const {actions, store} = makeThread()
    actions.applyThreadLoad({...base, centered: true, messages: [textAt(5), textAt(6)]})
    const before = store.getState()
    actions.applyThreadLoad({...base, messages: [textAt(50)]})
    expect(store.getState()).toBe(before)
    actions.applyThreadLoad({...base, messages: [textAt(6), textAt(7)]})
    expect(store.getState().messageOrdinals).toEqual([5, 6, 7])
  })

  test('only a pass that rendered a row drops the window gate', () => {
    const {actions, store} = makeThread()
    actions.messagesClear()
    actions.claimWindowGate(1)
    actions.applyThreadLoad({...base, messages: [makeMessageDeleted({conversationIDKey: convA, id: T.Chat.numberToMessageID(5), ordinal: T.Chat.numberToOrdinal(5)})]})
    expect(store.getState().windowCleared).toBe(true)
    actions.applyThreadLoad({...base, messages: [textAt(6)]})
    expect([store.getState().windowCleared, store.getState().windowGateOwner]).toEqual([false, undefined])
  })
})

describe('store writes', () => {
  test('a write that changes nothing does not notify subscribers', () => {
    const {actions, store} = makeThread()
    const listener = jest.fn()
    store.subscribe(listener)
    actions.setTyping(new Set())
    actions.clearUnfurlPrompt(T.Chat.numberToMessageID(1), 'a.com')
    actions.updateOptimisticReactionDecorated(T.Chat.stringToOutboxID('none'), 'x')
    actions.clearWindowGate(1)
    actions.claimWindowGate(1)
    expect(listener).not.toHaveBeenCalled()
    actions.setTyping(new Set(['testuser2']))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('messagesClear empties the window, opens the gate and drops the username cache', () => {
    const {actions, shownUsernameCache, store} = makeThread()
    actions.addMessages([textAt(5, {outboxID: T.Chat.stringToOutboxID('o1')})])
    shownUsernameCache.set(T.Chat.numberToOrdinal(5), 'testuser2')
    actions.messagesClear()
    const s = store.getState()
    expect([s.clearVersion, s.loaded, s.windowCleared, s.windowGateOwner]).toEqual([1, false, true, undefined])
    expect([s.messageMap.size, s.messageIDToOrdinal.size, s.messageTypeMap.size]).toEqual([0, 0, 0])
    expect(s.messageOrdinals).toBeUndefined()
    expect(shownUsernameCache.size).toBe(0)
  })

  test('the window gate: first claim wins, only the owner or anyone on an unclaimed gate releases', () => {
    const {actions, store} = makeThread()
    actions.messagesClear()
    actions.claimWindowGate(1)
    actions.claimWindowGate(2)
    actions.clearWindowGate(2)
    expect(store.getState().windowGateOwner).toBe(1)
    actions.clearWindowGate(1)
    expect(store.getState().windowCleared).toBe(false)
    actions.messagesClear()
    actions.clearWindowGate(7)
    expect(store.getState().windowCleared).toBe(false)
  })

  test('addMessages drops rows below the window and bumps the live version when live', () => {
    const {actions, store} = makeThread()
    actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: false,
      messages: [textAt(5)],
      moreToLoad: true,
      scrollDirection: 'none',
    })
    actions.addMessages([textAt(3), textAt(6)], {liveUpdate: true})
    expect(store.getState().messageOrdinals).toEqual([5, 6])
    expect(store.getState().liveUpdateVersion).toBe(1)
  })

  test('a fresh copy of the target row clears its optimistic reactions', () => {
    const {actions, store} = makeThread()
    actions.addOptimisticReaction(T.Chat.stringToOutboxID('r1'), {
      add: true,
      decorated: '',
      emoji: ':+1:',
      targetOrdinal: T.Chat.numberToOrdinal(5),
      timestamp: 1,
      username: 'testuser',
    })
    actions.updateOptimisticReactionDecorated(T.Chat.stringToOutboxID('r1'), 'd')
    expect(store.getState().optimisticReactionMap.get(T.Chat.stringToOutboxID('r1'))?.decorated).toBe('d')
    actions.addMessages([textAt(6)])
    expect(store.getState().optimisticReactionMap.size).toBe(1)
    actions.addMessages([textAt(5)])
    expect(store.getState().optimisticReactionMap.size).toBe(0)
  })

  test('removeOptimisticReaction drops one entry', () => {
    const {actions, store} = makeThread()
    const reaction = {
      add: true,
      decorated: '',
      emoji: ':+1:',
      targetOrdinal: T.Chat.numberToOrdinal(5),
      timestamp: 1,
      username: 'testuser',
    }
    actions.addOptimisticReaction(T.Chat.stringToOutboxID('r1'), reaction)
    actions.addOptimisticReaction(T.Chat.stringToOutboxID('r2'), reaction)
    actions.removeOptimisticReaction(T.Chat.stringToOutboxID('r1'))
    expect([...store.getState().optimisticReactionMap.keys()]).toEqual(['r2'])
  })

  test('deleteMessages, explodeMessages and setMessageSubmitState', () => {
    const {actions, store} = makeThread()
    actions.addMessages([textAt(5), textAt(6), textAt(7)])
    actions.deleteMessages({messageIDs: [T.Chat.numberToMessageID(5)]})
    actions.explodeMessages([T.Chat.numberToMessageID(6)], undefined, true)
    actions.setMessageSubmitState(T.Chat.numberToOrdinal(7), 'editing')
    const s = store.getState()
    expect(s.messageOrdinals).toEqual([6, 7])
    expect(s.messageMap.get(T.Chat.numberToOrdinal(6))?.exploded).toBe(true)
    expect(s.messageMap.get(T.Chat.numberToOrdinal(7))?.submitState).toBe('editing')
    expect(s.liveUpdateVersion).toBe(1)
  })

  test('setMessageErrored then retryMessage, which also asks the service', async () => {
    const {actions, store} = makeThread()
    const outboxID = T.Chat.stringToOutboxID('ab01')
    actions.addMessages([textAt(5, {id: T.Chat.numberToMessageID(0), outboxID, submitState: 'pending'})])
    actions.setMessageErrored(outboxID, 'bad', 2)
    expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(5))?.submitState).toBe('failed')
    actions.retryMessage(outboxID)
    await flushPromises()
    expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(5))?.submitState).toBe('pending')
    expect(paramsOf(fake, retryPost)).toEqual([{outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)}])
  })

  test('reactions: a missing target does not bump the live version', () => {
    const {actions, store} = makeThread()
    actions.addMessages([textAt(5)])
    actions.updateReactions([{targetMsgID: T.Chat.numberToMessageID(9)}])
    expect(store.getState().liveUpdateVersion).toBe(0)
    const reactions: T.Chat.Reactions = new Map([
      [':+1:', {decorated: ':+1:', users: [{timestamp: 1, username: 'testuser2'}]}],
    ])
    actions.updateReactions([{reactions, targetMsgID: T.Chat.numberToMessageID(5)}])
    expect(store.getState().liveUpdateVersion).toBe(1)
    expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(5))?.reactions?.size).toBe(1)
  })

  test('payments, requests, unfurl prompts and coin flips', () => {
    const {actions, store} = makeThread()
    const payment = {paymentID: 'p1'} as unknown as T.Chat.ChatPaymentInfo
    actions.receivePaymentInfo(T.Chat.numberToMessageID(1), payment)
    actions.receiveRequestInfo(T.Chat.numberToMessageID(2), {amount: '1'} as unknown as T.Chat.ChatRequestInfo)
    actions.showUnfurlPrompt(T.Chat.numberToMessageID(3), 'a.com')
    actions.updateCoinFlipStatuses([{gameID: 'g'} as unknown as T.RPCChat.UICoinFlipStatus])
    const s = store.getState()
    expect(s.accountsInfoMap.size).toBe(2)
    expect(s.paymentStatusMap.get('p1')).toBe(payment)
    expect([...(s.unfurlPrompt.get(T.Chat.numberToMessageID(3)) ?? [])]).toEqual(['a.com'])
    expect(s.flipStatusMap.has('g')).toBe(true)
  })

  test('attachment transfers', () => {
    const {actions, store} = makeThread()
    const ordinal = T.Chat.numberToOrdinal(5)
    const outboxID = T.Chat.stringToOutboxID('abcd')
    actions.addMessages([
      makeMessageAttachment({conversationIDKey: convA, id: T.Chat.numberToMessageID(5), ordinal}),
      makeMessageAttachment({
        conversationIDKey: convA,
        id: T.Chat.numberToMessageID(0),
        ordinal: T.Chat.numberToOrdinal(6),
        outboxID,
        submitState: 'pending',
      }),
    ])
    const row = (o = ordinal) => store.getState().messageMap.get(o) as T.Chat.MessageAttachment
    actions.startAttachmentDownload(ordinal)
    actions.updateAttachmentDownloadProgress(5, 1, 4)
    expect([row().transferState, row().transferProgress]).toEqual(['downloading', 0.25])
    actions.completeAttachmentDownload(5)
    actions.finishAttachmentDownload(ordinal, '/tmp/x')
    expect(row().downloadPath).toBe('/tmp/x')
    actions.failAttachmentDownload(ordinal, 'err')
    expect(row().transferErrMsg).toBe('err')
    actions.setAttachmentMobileSaving(ordinal, true)
    expect(row().transferState).toBe('mobileSaving')
    actions.updateAttachmentUploadProgress(T.Chat.outboxIDToRpcOutboxID(outboxID), 1, 2)
    expect(row(T.Chat.numberToOrdinal(6)).transferProgress).toBe(0.5)
  })

  test('setExplodingMode: local persists through the service with the dep meta, incoming does not', async () => {
    const {actions, store} = makeThread()
    actions.setExplodingMode(300, true)
    await flushPromises()
    expect(fake.calls).toEqual([])
    actions.setExplodingMode(300)
    actions.setExplodingMode(0)
    await flushPromises()
    expect(store.getState().explodingMode).toBe(0)
    expect(fake.calls.map(c => [c.method, c.params.category, c.params.body])).toEqual([
      [updateCategory, `exploding:${convA}`, '300'],
      [dismissCategory, `exploding:${convA}`, undefined],
    ])
  })
})

describe('a store whose account has left', () => {
  const leave = () => {
    setSession({loggedIn: true, uid: 'uid-2'})
  }

  test('does nothing, whatever action it is asked for', async () => {
    const {actions, store} = makeThread()
    const outboxID = T.Chat.stringToOutboxID('o1')
    arm(actions, [textAt(5), textAt(6, {id: T.Chat.numberToMessageID(0), outboxID, submitState: 'failed'})])
    const callsBefore = fake.calls.length
    const before = store.getState()
    leave()
    actions.addMessages([textAt(8)])
    actions.retryMessage(outboxID)
    actions.markThreadAsRead()
    actions.setMarkAsUnread(T.Chat.numberToMessageID(6))
    actions.setExplodingMode(300)
    actions.setExplodingMode(60, true)
    actions.loadMoreMessages({reason: 'jump to recent'})
    // every other action too, with arguments it would fail on if it ran at all
    for (const key of Object.keys(actions) as Array<keyof typeof actions>) {
      if (key !== 'getSnapshot' && key !== 'isRetired' && key !== 'rpc') {
        expect(() => (actions[key] as () => void)()).not.toThrow()
      }
    }
    // and every service call a screen makes through the thread
    for (const call of Object.values(actions.rpc) as Array<() => Promise<unknown>>) {
      void call()
    }
    await flushPromises()
    expect(store.getState()).toBe(before)
    expect(fake.calls.slice(callsBefore)).toEqual([])
  })

  test('the message commands given its rows ask the service nothing', async () => {
    useCurrentUserState
      .getState()
      .dispatch.setBootstrap({deviceID: 'device-id', deviceName: 'device', uid: 'uid', username: 'testuser'})
    const {actions, store} = makeThread()
    arm(actions, [textAt(5)])
    const callsBefore = fake.calls.length
    const before = store.getState()
    leave()
    const row = {conversationIDKey: convA, ordinal: T.Chat.numberToOrdinal(5), thread: actions}
    deleteMessage(row)
    toggleReaction(row, ':+1:')
    toggleCollapse(row, T.Chat.numberToMessageID(5))
    replyPrivately(row)
    dismissJourneycard(row, T.RPCChat.JourneycardType.welcome)
    await flushPromises()
    expect(fake.calls.slice(callsBefore)).toEqual([])
    expect(store.getState()).toBe(before)
  })

  test('a load streaming after it left applies nothing', async () => {
    const held = fake.hold(getThreadNonblock)
    const {actions, store} = makeThread()
    actions.loadMoreMessages({reason: 'jump to recent'})
    await sent()
    leave()
    await threadLoadOf(fake, held[0]!.params).full(placeholders([5]))
    await flushPromises()
    expect(store.getState().loaded).toBe(false)
    held[0]!.reply({offline: false})
  })

  test('the service answering a load after it left writes nothing', async () => {
    const held = fake.hold(getThreadNonblock)
    const {actions} = makeThread()
    actions.loadMoreMessages({reason: 'jump to recent'})
    await flushPromises()
    expect(held).toHaveLength(1)
    leave()
    held[0]!.reply({offline: true})
    await flushPromises()
    expect(useInboxMetadataState.getState().metas.get(convA)?.offline).toBe(false)
  })

  test('a mark unread waiting on the service is not sent once it left', async () => {
    // the load finds a message below the line, so only the retire stops the mark read
    answerThreadLoads(fake, async l => {
      await l.full(placeholders([7, 8]))
      await settle()
    })
    const {actions} = makeThread()
    actions.setMarkAsUnread(T.Chat.numberToMessageID(8))
    leave()
    await flushPromises()
    expect(loads()).toHaveLength(1)
    expect(markReads()).toEqual([])
  })

  test('stays retired when its account signs back in', () => {
    const {actions, store} = makeThread()
    leave()
    actions.addMessages([textAt(5)])
    setSession({loggedIn: true, uid: 'uid'})
    actions.addMessages([textAt(6)])
    expect(store.getState().messageOrdinals).toBeUndefined()
  })

  test('an unmount while nobody is signed in retires it, though nothing asked in between', () => {
    const thread = makeThread()
    setSession({loggedIn: false, uid: ''})
    thread.dispose()
    setSession({loggedIn: true, uid: 'uid'})
    thread.actions.addMessages([textAt(5)])
    thread.markReadIfArmed()
    expect(thread.store.getState().messageOrdinals).toBeUndefined()
  })
})

describe('two stores', () => {
  test('keep separate state, caches and mark-read flags', async () => {
    const a = makeThread(convA)
    const b = makeThread(convB)
    arm(a.actions, [textAt(5)])
    b.actions.addMessages([textAt(9, undefined, convB)])
    a.shownUsernameCache.set(T.Chat.numberToOrdinal(5), 'testuser2')
    b.actions.messagesClear()
    expect(a.store.getState().messageOrdinals).toEqual([5])
    expect(a.shownUsernameCache.size).toBe(1)
    expect(b.store.getState().clearVersion).toBe(1)
    expect(a.store.getState().clearVersion).toBe(0)
    b.actions.markThreadAsRead()
    a.actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([{conversationIDKey: convA, forceUnread: false, msgID: 5}])
  })

  test('throttle and dispose independently', async () => {
    jest.useFakeTimers()
    const a = makeThread(convA)
    const b = makeThread(convB)
    a.actions.loadMoreMessages({reason: 'scroll back', scrollDirection: 'back'})
    b.actions.loadMoreMessages({reason: 'scroll back', scrollDirection: 'back'})
    a.actions.loadMoreMessages({reason: 'scroll back', scrollDirection: 'back'})
    b.actions.loadMoreMessages({reason: 'scroll back', scrollDirection: 'back'})
    a.dispose()
    jest.advanceTimersByTime(1000)
    await sent()
    expect(loads().map(l => l.conversationIDKey)).toEqual([convA, convB, convB])
  })

  test('each looks at its own conversation meta', async () => {
    setMeta(convB, {readMsgID: T.Chat.numberToMessageID(-1)})
    const a = makeThread(convA)
    const b = makeThread(convB)
    arm(a.actions, [textAt(5)])
    arm(b.actions, [textAt(5, undefined, convB)])
    a.actions.markThreadAsRead()
    b.actions.markThreadAsRead()
    await flushPromises()
    expect(markReads().map(p => p.conversationIDKey)).toEqual([convA])
  })
})
