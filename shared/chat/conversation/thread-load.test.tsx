/// <reference types="jest" />
import * as T from '@/constants/types'
import {makeMessageText} from '@/constants/chat/message'
import {
  getClientPrevFromSnapshot,
  getExplodingModeFromGregorItems,
  getLastOrdinalFromSnapshot,
  getOrdinalForMessageIDInSnapshot,
  scrollDirectionToPagination,
} from './thread-load'
import type {ConversationThreadState} from './thread-context'

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
