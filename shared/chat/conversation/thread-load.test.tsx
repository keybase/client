/// <reference types="jest" />
import * as T from '@/constants/types'
import {makeMessageText} from '@/constants/chat/message'
import {
  getClientPrevFromSnapshot,
  getExplodingModeFromGregorItems,
  getLastOrdinalFromSnapshot,
  getOrdinalForMessageIDInSnapshot,
  loadConversationThreadMessages,
  maxEmptyBackPageRetries,
  scrollDirectionToPagination,
  shouldRetryEmptyBackPage,
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

describe('shouldRetryEmptyBackPage', () => {
  // A back page that arrived, said there is more to come, and left the ordinal list exactly as it
  // was. This is the stall: nothing changed, so onStartReached never fires again.
  const stalled = {
    authoritative: true,
    incoming: 882,
    moreToLoad: true,
    ordinalsAfter: 180,
    ordinalsBefore: 180,
    retries: 0,
    scrollDirection: 'back' as const,
  }

  test('retries a back page that yielded no new ordinals', () => {
    expect(shouldRetryEmptyBackPage(stalled)).toBe(true)
  })

  test('does not retry when the page actually added ordinals', () => {
    expect(shouldRetryEmptyBackPage({...stalled, ordinalsAfter: 274})).toBe(false)
  })

  test('does not retry when the pager says this was the last page', () => {
    expect(shouldRetryEmptyBackPage({...stalled, moreToLoad: false})).toBe(false)
  })

  test('does not retry an empty response', () => {
    // Nothing came back at all, which is a different situation: the load already settled.
    expect(shouldRetryEmptyBackPage({...stalled, incoming: 0})).toBe(false)
  })

  test('only retries backwards scrollback', () => {
    expect(shouldRetryEmptyBackPage({...stalled, scrollDirection: 'none'})).toBe(false)
    expect(shouldRetryEmptyBackPage({...stalled, scrollDirection: 'forward'})).toBe(false)
  })

  test('ignores the cached pass', () => {
    // Once a cached thread has been sent the service switches the full response to INCREMENTAL, so
    // a cached pass adding nothing new is normal and must not trigger a retry.
    expect(shouldRetryEmptyBackPage({...stalled, authoritative: false})).toBe(false)
  })

  test('is bounded', () => {
    for (let retries = 0; retries < maxEmptyBackPageRetries; retries++) {
      expect(shouldRetryEmptyBackPage({...stalled, retries})).toBe(true)
    }
    expect(shouldRetryEmptyBackPage({...stalled, retries: maxEmptyBackPageRetries})).toBe(false)
    expect(shouldRetryEmptyBackPage({...stalled, retries: maxEmptyBackPageRetries + 1})).toBe(false)
  })

  test('retries when a page somehow shrank the list', () => {
    // A back page whose only effect was to delete messages already in the window leaves even less
    // than before, and still needs something to re-trigger the load.
    expect(shouldRetryEmptyBackPage({...stalled, ordinalsAfter: 174})).toBe(true)
  })
})

describe('an empty back page re-triggers the load', () => {
  const flushPromises = async () => {
    for (let i = 0; i < 30; i++) {
      await Promise.resolve()
    }
  }

  // The thread never grows: whatever the page contained, addMessages dropped all of it. That is the
  // condition LegendList cannot see, because `messageOrdinals` is byte-identical afterwards.
  const makeFrozenActions = () => {
    const snapshot = {
      liveUpdateVersion: 0,
      loaded: true,
      messageIDToOrdinal: new Map(),
      messageMap: new Map(),
      messageOrdinals: [T.Chat.numberToOrdinal(7152), T.Chat.numberToOrdinal(7153)],
      pendingOutboxToOrdinal: new Map(),
    } as unknown as ConversationThreadState
    const applyThreadLoad = jest.fn()
    return {
      actions: {
        applyThreadLoad,
        getSnapshot: () => snapshot,
        markThreadAsRead: jest.fn(),
      } as unknown as ConversationThreadActions,
      applyThreadLoad,
    }
  }

  // A page that parses to real messages, so `incoming > 0`, with the pager still saying there is
  // more to come.
  const mockPage = (last: boolean) =>
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      const messages = [7150, 7151].map(id => ({
        placeholder: {hidden: false, messageID: T.Chat.numberToMessageID(id)},
        state: T.RPCChat.MessageUnboxedState.placeholder,
      }))
      await Promise.resolve()
      p.onFullThread?.(JSON.stringify({messages, pagination: {last, num: 100}}))
      return undefined as never
    })

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

  test('re-issues the page, and stops at the bound', async () => {
    const rpc = mockPage(false)
    const {actions} = makeFrozenActions()
    loadConversationThreadMessages(
      conversationIDKey,
      {reason: 'scroll back', scrollDirection: 'back'},
      actions
    )
    await flushPromises()
    // The original call plus one per retry, and then it gives up rather than spinning.
    expect(rpc).toHaveBeenCalledTimes(1 + maxEmptyBackPageRetries)
  })

  test('does not re-issue once the pager says it is the last page', async () => {
    const rpc = mockPage(true)
    const {actions} = makeFrozenActions()
    loadConversationThreadMessages(
      conversationIDKey,
      {reason: 'scroll back', scrollDirection: 'back'},
      actions
    )
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('does not re-issue an initial load', async () => {
    const rpc = mockPage(false)
    const {actions} = makeFrozenActions()
    loadConversationThreadMessages(conversationIDKey, {reason: 'focused'}, actions)
    await flushPromises()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
