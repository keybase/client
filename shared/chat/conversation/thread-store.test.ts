/// <reference types="jest" />
// makeThreadStore on its own: no provider, no React. The service goes through the fake chat RPC;
// the session and conversation meta are the real stores.
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import logger from '@/logger'
import {makeMessageAttachment, makeMessageDeleted, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {makeThreadStore, type ConversationThreadActions, type LoadMoreMessagesParams} from './thread-store'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

let rpc: FakeChatRpc

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

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

// whether the reader is looking at the thread, as the provider reports it when asked
let looking = true
const makeThread = (id = convA) => makeThreadStore(id, () => looking)

const arm = (actions: ConversationThreadActions, messages: ReadonlyArray<T.Chat.Message>) =>
  actions.applyThreadLoad({
    centered: false,
    enableActiveMarkRead: true,
    messages,
    moreToLoad: false,
    scrollDirection: 'none',
  })

const markReads = () => rpc.params('markRead')
const loads = () => rpc.params('loadThread')

beforeEach(() => {
  looking = true
  rpc = installFakeChatRpc()
  setSession({loggedIn: true, uid: 'uid'})
  setMeta(convA, {})
  setMeta(convB, {})
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
  restoreChatRpc()
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
    const {actions} = makeThreadStore(convA, () => false)
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
    setSession({loggedIn: true, uid: 'uid-2'})
    actions.markThreadAsRead()
    await flushPromises()
    expect(markReads()).toEqual([])
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

  test('addMessages with markAsRead and every updateReactions ask to mark', async () => {
    const {actions} = makeThread()
    arm(actions, [textAt(5)])
    actions.addMessages([textAt(6)], {markAsRead: true})
    await flushPromises()
    actions.updateReactions([])
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

  test('false, or logged out, does nothing', async () => {
    const {actions} = makeThread()
    actions.addMessages([textAt(3)])
    actions.setMarkAsUnread(false)
    setSession({loggedIn: false, uid: 'uid'})
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

  test('asks the service for its conversation and the window the load names', () => {
    const {actions} = makeThread()
    actions.loadMoreMessages(scroll(1))
    expect(loads()).toEqual([
      expect.objectContaining({conversationIDKey: convA, pagination: expect.objectContaining({num: 1})}),
    ])
  })

  test('throttles to the first and last call in 500ms', () => {
    jest.useFakeTimers()
    const {actions} = makeThread()
    actions.loadMoreMessages(scroll(1))
    actions.loadMoreMessages(scroll(2))
    actions.loadMoreMessages(scroll(3))
    jest.advanceTimersByTime(499)
    expect(loads().map(l => l.pagination?.num)).toEqual([1])
    jest.advanceTimersByTime(1)
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
  ])('%s runs at once and drops the pending call', (_, p) => {
    jest.useFakeTimers()
    const {actions} = makeThread()
    actions.loadMoreMessages(scroll(1))
    actions.loadMoreMessages(scroll(2))
    actions.loadMoreMessages(p)
    expect(loads().map(l => l.knownRemotes)).toEqual([undefined, ['p']])
    jest.advanceTimersByTime(1000)
    expect(loads()).toHaveLength(2)
  })

  test('dispose drops the pending call and leaves the store working', () => {
    jest.useFakeTimers()
    const thread = makeThread()
    thread.actions.loadMoreMessages(scroll(1))
    thread.actions.loadMoreMessages(scroll(2))
    thread.dispose()
    jest.advanceTimersByTime(1000)
    expect(loads()).toHaveLength(1)
    thread.dispose()
    thread.actions.loadMoreMessages(scroll(3))
    thread.actions.addMessages([textAt(1)])
    expect(loads().map(l => l.pagination?.num)).toEqual([1, 3])
    expect(thread.store.getState().messageOrdinals).toEqual([1])
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
    actions.setMessageSubmitState(T.Chat.numberToOrdinal(7), 'deleting')
    const s = store.getState()
    expect(s.messageOrdinals).toEqual([6, 7])
    expect(s.messageMap.get(T.Chat.numberToOrdinal(6))?.exploded).toBe(true)
    expect(s.messageMap.get(T.Chat.numberToOrdinal(7))?.submitState).toBe('deleting')
    expect(s.liveUpdateVersion).toBe(1)
  })

  test('setMessageErrored then retryMessage, which also asks the service', async () => {
    const {actions, store} = makeThread()
    const outboxID = T.Chat.stringToOutboxID('o1')
    actions.addMessages([textAt(5, {id: T.Chat.numberToMessageID(0), outboxID, submitState: 'pending'})])
    actions.setMessageErrored(outboxID, 'bad', 2)
    expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(5))?.submitState).toBe('failed')
    actions.retryMessage(outboxID)
    await flushPromises()
    expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(5))?.submitState).toBe('pending')
    expect(rpc.calls('retryPost')).toEqual([[outboxID]])
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
    expect(s.paymentStatusMap.get('p1' as T.Wallets.PaymentID)).toBe(payment)
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
    expect(rpc.log).toEqual([])
    actions.setExplodingMode(300)
    actions.setExplodingMode(0)
    await flushPromises()
    expect(store.getState().explodingMode).toBe(0)
    expect(rpc.log.map(l => [l.method, ...l.args])).toEqual([
      ['setExplodingMode', convA, 300],
      ['clearExplodingMode', convA],
    ])
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

  test('throttle and dispose independently', () => {
    jest.useFakeTimers()
    const a = makeThread(convA)
    const b = makeThread(convB)
    a.actions.loadMoreMessages({reason: 'scroll back', scrollDirection: 'back'})
    b.actions.loadMoreMessages({reason: 'scroll back', scrollDirection: 'back'})
    a.actions.loadMoreMessages({reason: 'scroll back', scrollDirection: 'back'})
    b.actions.loadMoreMessages({reason: 'scroll back', scrollDirection: 'back'})
    a.dispose()
    jest.advanceTimersByTime(1000)
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
