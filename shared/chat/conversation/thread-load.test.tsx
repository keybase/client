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

  // A stand-in for the real store that keeps the one behaviour under test: applying a load adds an
  // ordinal per message EXCEPT the ones addMessagesToThreadState drops, which is `deleted`. A fake
  // that grows unconditionally would make every page look productive and hide the bug; one that
  // never grows would make every page look empty and hide the opposite bug.
  const trackingActions = () => {
    const ordinals = new Set<T.Chat.Ordinal>([
      T.Chat.numberToOrdinal(7152),
      T.Chat.numberToOrdinal(7153),
    ])
    return {
      applyThreadLoad: jest.fn((p: {messages: ReadonlyArray<T.Chat.Message>}) => {
        for (const m of p.messages) {
          if (m.type !== 'deleted') {
            ordinals.add(m.ordinal)
          }
        }
      }),
      getSnapshot: () =>
        ({
          liveUpdateVersion: 0,
          loaded: true,
          messageIDToOrdinal: new Map(),
          messageMap: new Map(),
          messageOrdinals: [...ordinals].sort((a, b) => a - b),
          pendingOutboxToOrdinal: new Map(),
        }) as unknown as ConversationThreadState,
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

  // hidden: false parses to a `placeholder`, which the thread does render and keep an ordinal for.
  const visible = (from: number, to: number) =>
    Array.from({length: from - to + 1}, (_, i) => ({
      placeholder: {hidden: false, messageID: T.Chat.numberToMessageID(from - i)},
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
    loadBack(trackingActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  test('walks a long run without a retry budget to outrun', async () => {
    // 1000 tombstones is far past any fixed retry count.
    const oldest = 6152
    const rpc = mockWalkingBack(oldest)
    loadBack(trackingActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(Math.ceil((7151 - oldest + 1) / numMessagesOnScrollback))
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
    loadBack(trackingActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  test('does not reload when the page actually added ordinals', async () => {
    // Renderable messages, so the store grows and the list will ask for the next page itself.
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onFullThread?.(
        JSON.stringify({messages: visible(7151, 7052), pagination: {last: false, num: 100}})
      )
      return undefined as never
    })
    loadBack(trackingActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('does not reload after a cached pass already delivered the page', async () => {
    // The normal warm-cache sequence: PullLocalOnly wins, the cached pass carries the whole page,
    // and the full pass that follows is INCREMENTAL - only the messages that changed, every one of
    // them already in the window. On ordinal count alone that is indistinguishable from a page of
    // tombstones, and reloading on it walks the client back through the entire conversation.
    const rpc = jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      await Promise.resolve()
      p.onCachedThread?.(
        JSON.stringify({messages: visible(7151, 7052), pagination: {last: false, num: 100}})
      )
      p.onFullThread?.(
        JSON.stringify({messages: visible(7052, 7052), pagination: {last: false, num: 100}})
      )
      return undefined as never
    })
    loadBack(trackingActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('does not reload an initial load', async () => {
    const rpc = mockWalkingBack(6152)
    loadConversationThreadMessages(conversationIDKey, {reason: 'focused'}, trackingActions())
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
