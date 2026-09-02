/// <reference types="jest" />
import * as T from '@/constants/types'
import {makeMessageText} from '@/constants/chat/message'
import {
  getClientPrevFromSnapshot,
  getExplodingModeFromGregorItems,
  getLastOrdinalFromSnapshot,
  getOrdinalForMessageIDInSnapshot,
  loadConversationThreadMessages,
  numMessagesOnScrollback,
  scrollDirectionToPagination,
} from './thread-load'
import * as ThreadRpc from './thread-rpc'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import type {ConversationThreadActions, ConversationThreadState} from './thread-context'

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const otherConversationIDKey = T.Chat.stringToConversationIDKey('conv2')

const gregorItem = (category: string, body: string) => ({
  item: {
    body: new TextEncoder().encode(body),
    category,
  } as T.RPCGen.Gregor1.Item,
})

describe('getExplodingModeFromGregorItems', () => {
  test('no exploding items at all means no exploding mode', () => {
    expect(getExplodingModeFromGregorItems(conversationIDKey, [])).toBe(0)
    expect(getExplodingModeFromGregorItems(conversationIDKey, [gregorItem('other:thing', '60')])).toBe(0)
  })

  test('reads the seconds for this conversation', () => {
    const items = [
      gregorItem(`exploding:${otherConversationIDKey}`, '3600'),
      gregorItem(`exploding:${conversationIDKey}`, '300'),
    ]
    expect(getExplodingModeFromGregorItems(conversationIDKey, items)).toBe(300)
  })

  test('a dismissed category with other conversations present means off', () => {
    const items = [gregorItem(`exploding:${otherConversationIDKey}`, '3600')]
    expect(getExplodingModeFromGregorItems(conversationIDKey, items)).toBe(0)
  })

  test('unparseable seconds yield undefined so callers can fall back', () => {
    const items = [gregorItem(`exploding:${conversationIDKey}`, 'garbage')]
    expect(getExplodingModeFromGregorItems(conversationIDKey, items)).toBeUndefined()
  })
})

describe('scrollDirectionToPagination', () => {
  test('none sends no cursor', () => {
    expect(scrollDirectionToPagination('none', 20)).toEqual({last: false, next: '', num: 20, previous: ''})
  })

  test('back pages older, forward pages newer', () => {
    expect(scrollDirectionToPagination('back', 100)).toEqual({
      last: false,
      next: 'deadbeef',
      num: 100,
      previous: '',
    })
    expect(scrollDirectionToPagination('forward', 100)).toEqual({
      last: false,
      next: '',
      num: 100,
      previous: 'deadbeef',
    })
  })
})

describe('snapshot helpers', () => {
  const ordinal = (n: number) => T.Chat.numberToOrdinal(n)
  const messageID = (n: number) => T.Chat.numberToMessageID(n)

  const makeSnapshot = (
    messages: ReadonlyArray<{id: number; ordinal: number}>,
    extra: Partial<ConversationThreadState> = {}
  ) =>
    ({
      messageIDToOrdinal: new Map(messages.map(m => [messageID(m.id), ordinal(m.ordinal)])),
      messageMap: new Map(
        messages.map(m => [
          ordinal(m.ordinal),
          makeMessageText({
            conversationIDKey,
            id: messageID(m.id),
            ordinal: ordinal(m.ordinal),
          }),
        ])
      ),
      messageOrdinals: messages.map(m => ordinal(m.ordinal)),
      pendingOutboxToOrdinal: new Map(),
      ...extra,
    }) as unknown as ConversationThreadState

  test('getClientPrevFromSnapshot returns 0 for an empty thread', () => {
    expect(getClientPrevFromSnapshot(makeSnapshot([]))).toBe(0)
  })

  test('getClientPrevFromSnapshot skips trailing pending messages with no id', () => {
    const snapshot = makeSnapshot([
      {id: 1, ordinal: 1},
      {id: 2, ordinal: 2},
    ])
    // a pending (outbox) message has id 0 and a fractional ordinal
    const pendingOrdinal = ordinal(2.001)
    snapshot.messageMap.set(
      pendingOrdinal,
      makeMessageText({conversationIDKey, id: messageID(0), ordinal: pendingOrdinal})
    )
    const withPending = {
      ...snapshot,
      messageOrdinals: [...(snapshot.messageOrdinals ?? []), pendingOrdinal],
    } as ConversationThreadState

    expect(getClientPrevFromSnapshot(withPending)).toBe(2)
  })

  test('getLastOrdinalFromSnapshot returns the last ordinal or 0', () => {
    expect(getLastOrdinalFromSnapshot(makeSnapshot([]))).toBe(0)
    expect(
      getLastOrdinalFromSnapshot(
        makeSnapshot([
          {id: 1, ordinal: 1},
          {id: 4, ordinal: 4},
        ])
      )
    ).toBe(4)
  })

  test('getOrdinalForMessageIDInSnapshot finds messages by id', () => {
    const snapshot = makeSnapshot([
      {id: 1, ordinal: 1},
      {id: 4, ordinal: 4},
    ])
    expect(getOrdinalForMessageIDInSnapshot(snapshot, messageID(4))).toBe(4)
    expect(getOrdinalForMessageIDInSnapshot(snapshot, messageID(99))).toBeNull()
  })

  test('getOrdinalForMessageIDInSnapshot finds sent outbox messages at fractional ordinals', () => {
    const outboxID = T.Chat.stringToOutboxID('outbox1')
    const pendingOrdinal = ordinal(4.001)
    const snapshot = makeSnapshot([{id: 1, ordinal: 1}])
    snapshot.messageMap.set(
      pendingOrdinal,
      makeMessageText({conversationIDKey, id: messageID(5), ordinal: pendingOrdinal, outboxID})
    )
    snapshot.pendingOutboxToOrdinal.set(outboxID, pendingOrdinal)

    expect(getOrdinalForMessageIDInSnapshot(snapshot, messageID(5))).toBe(pendingOrdinal)
  })

  test('getOrdinalForMessageIDInSnapshot ignores a stale index entry', () => {
    const snapshot = makeSnapshot([{id: 1, ordinal: 1}])
    // index claims 7 lives at ordinal 1, but ordinal 1 holds message 1
    snapshot.messageIDToOrdinal.set(messageID(7), ordinal(1))
    expect(getOrdinalForMessageIDInSnapshot(snapshot, messageID(7))).toBeNull()
  })
})

describe('a back page that adds no ordinals reloads itself', () => {
  const flushPromises = async () => {
    for (let i = 0; i < 200; i++) {
      await Promise.resolve()
    }
  }

  // The thread never grows: whatever a page contained, addMessages dropped all of it. That is the
  // condition the list cannot see, because `messageOrdinals` is identical afterwards.
  const frozenActions = () => {
    const snapshot = {
      liveUpdateVersion: 0,
      loaded: true,
      messageIDToOrdinal: new Map(),
      messageMap: new Map(),
      messageOrdinals: [T.Chat.numberToOrdinal(7152), T.Chat.numberToOrdinal(7153)],
      pendingOutboxToOrdinal: new Map(),
    } as unknown as ConversationThreadState
    return {
      applyThreadLoad: jest.fn(),
      getSnapshot: () => snapshot,
      markThreadAsRead: jest.fn(),
    } as unknown as ConversationThreadActions
  }

  // Hidden placeholders are what a DELETE-superseded message arrives as, and what becomes `deleted`
  // on this side. They carry real message IDs, which is what bounds the reload.
  const tombstones = (from: number, to: number) =>
    Array.from({length: from - to + 1}, (_, i) => ({
      placeholder: {hidden: true, messageID: T.Chat.numberToMessageID(from - i)},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    }))

  // Each call walks one page further back, exactly as the service does, until it runs out.
  const mockWalkingBack = (oldestOverall: number) => {
    let next = 7151
    return jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      const from = next
      const to = Math.max(oldestOverall, from - numMessagesOnScrollback + 1)
      next = to - 1
      await Promise.resolve()
      p.onFullThread?.(
        JSON.stringify({messages: tombstones(from, to), pagination: {last: to <= oldestOverall, num: 100}})
      )
      return undefined as never
    })
  }

  const loadBack = (actions: ConversationThreadActions) =>
    loadConversationThreadMessages(
      conversationIDKey,
      {numberOfMessagesToLoad: numMessagesOnScrollback, reason: 'scroll back', scrollDirection: 'back'},
      actions
    )

  beforeEach(() => {
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id',
      deviceName: 'testuser-mac',
      uid: 'uid',
      username: 'testuser',
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('keeps paging through a run of tombstones until the pager says it is done', async () => {
    // 7151 down to 6952 is two pages of 100, so one reload after the first call.
    const rpc = mockWalkingBack(6952)
    loadBack(frozenActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  test('walks a long run without a retry budget to outrun', async () => {
    // 1000 tombstones is far past any fixed retry count.
    const rpc = mockWalkingBack(6152)
    loadBack(frozenActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(10)
  })

  test('stops if a page fails to reach further back', async () => {
    // A service that keeps handing back the same window must not spin us forever. Progress in
    // message ID is the only thing permitting another attempt.
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onFullThread?.(
        JSON.stringify({messages: tombstones(7151, 7052), pagination: {last: false, num: 100}})
      )
      return undefined as never
    })
    loadBack(frozenActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  test('does not reload when the page actually added ordinals', async () => {
    const rpc = mockWalkingBack(6152)
    // A thread that grows when a page is applied, which is the normal case: the list changed, so
    // the list itself will ask for the next page when the reader keeps scrolling.
    let ordinals = 2
    const actions = {
      applyThreadLoad: jest.fn(() => {
        ordinals += numMessagesOnScrollback
      }),
      getSnapshot: () =>
        ({
          liveUpdateVersion: 0,
          loaded: true,
          messageIDToOrdinal: new Map(),
          messageMap: new Map(),
          messageOrdinals: new Array<T.Chat.Ordinal>(ordinals),
          pendingOutboxToOrdinal: new Map(),
        }) as unknown as ConversationThreadState,
      markThreadAsRead: jest.fn(),
    } as unknown as ConversationThreadActions
    loadBack(actions)
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('ignores the cached pass', async () => {
    // Once a cached thread has been sent the service filters the full response down to only what
    // changed, so a cached pass adding no ordinals is normal and must not start a reload.
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onCachedThread?.(
        JSON.stringify({messages: tombstones(7151, 7052), pagination: {last: false, num: 100}})
      )
      return undefined as never
    })
    loadBack(frozenActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('does not reload an initial load', async () => {
    const rpc = mockWalkingBack(6152)
    loadConversationThreadMessages(conversationIDKey, {reason: 'focused'}, frozenActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
