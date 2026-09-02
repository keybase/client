/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {
  addMessagesToThreadState,
  applyOptimisticReactionsToMessage,
  clearOptimisticReactionsForUpdatesInThreadState,
  deleteMessagesFromThreadState,
  explodeMessagesInThreadState,
  setMessageErroredInThreadState,
  type OptimisticReaction,
  updateReactionsInThreadState,
} from './thread-message-state'

type WritableConversationThreadMessageState = Parameters<typeof deleteMessagesFromThreadState>[0]
type WritableConversationThreadOptimisticState = WritableConversationThreadMessageState & {
  optimisticReactionMap: Map<T.Chat.OutboxID, OptimisticReaction>
}

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const ordinal = T.Chat.numberToOrdinal(10)
const msgID = T.Chat.numberToMessageID(101)
const outboxID = T.Chat.stringToOutboxID('outbox-1')

const makeReaction = (username: string, timestamp: number): T.Chat.ReactionDesc => ({
  decorated: ':+1:',
  users: [{timestamp, username}],
})

const makeTextMessage = (override?: Omit<Partial<T.Chat.MessageText>, 'text'> & {text?: string}) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: msgID,
    ordinal,
    outboxID,
    timestamp: 100,
    ...override,
    text: new HiddenString(override?.text ?? 'hello'),
  })

const makeAttachmentMessage = (override?: Partial<T.Chat.MessageAttachment>) =>
  Message.makeMessageAttachment({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(201),
    ordinal: T.Chat.numberToOrdinal(201),
    outboxID: T.Chat.stringToOutboxID('attachment-outbox'),
    timestamp: 100,
    title: 'attachment title',
    ...override,
  })

const makeThreadState = (
  messages: ReadonlyArray<T.Chat.Message>,
  extra?: Partial<WritableConversationThreadMessageState>
): WritableConversationThreadMessageState => {
  const sortedMessages = [...messages].sort((a, b) => a.ordinal - b.ordinal)
  const messageMap = new Map(sortedMessages.map(message => [message.ordinal, T.castDraft(message)]))
  const messageOrdinals = sortedMessages
    .filter(message => message.conversationMessage !== false && message.type !== 'deleted')
    .map(message => message.ordinal)
  const messageTypeMap = new Map<T.Chat.Ordinal, T.Chat.RenderMessageType>()
  const messageIDToOrdinal = new Map<T.Chat.MessageID, T.Chat.Ordinal>()
  const pendingOutboxToOrdinal = new Map<T.Chat.OutboxID, T.Chat.Ordinal>()
  sortedMessages.forEach(message => {
    if (message.type !== 'text') {
      messageTypeMap.set(message.ordinal, Message.getMessageRenderType(message))
    }
    if (message.id) {
      messageIDToOrdinal.set(message.id, message.ordinal)
    }
    if (message.outboxID) {
      pendingOutboxToOrdinal.set(message.outboxID, message.ordinal)
    }
  })
  return {
    messageIDToOrdinal,
    messageMap,
    messageOrdinals,
    messageTypeMap,
    moreToLoadForward: false,
    pendingOutboxToOrdinal,
    ...extra,
  }
}

test('deleteMessagesFromThreadState removes rows and render indexes without clearing outbox anchors', () => {
  const attachment = makeAttachmentMessage()
  const state = makeThreadState([makeTextMessage(), attachment])

  deleteMessagesFromThreadState(state, {messageIDs: [msgID, attachment.id]})

  expect(state.messageMap.has(ordinal)).toBe(false)
  expect(state.messageMap.has(attachment.ordinal)).toBe(false)
  expect(state.messageOrdinals).toEqual([])
  expect(state.messageIDToOrdinal.has(msgID)).toBe(false)
  expect(state.messageTypeMap.has(attachment.ordinal)).toBe(false)
  expect(state.pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
})

test('deleteMessagesFromThreadState honors deletable message types for expunge ranges', () => {
  const earlyText = makeTextMessage({
    id: T.Chat.numberToMessageID(501),
    ordinal: T.Chat.numberToOrdinal(501),
    outboxID: T.Chat.stringToOutboxID('early-text'),
  })
  const attachment = makeAttachmentMessage({
    id: T.Chat.numberToMessageID(502),
    ordinal: T.Chat.numberToOrdinal(502),
    outboxID: T.Chat.stringToOutboxID('early-attachment'),
  })
  const laterText = makeTextMessage({
    id: T.Chat.numberToMessageID(503),
    ordinal: T.Chat.numberToOrdinal(503),
    outboxID: T.Chat.stringToOutboxID('later-text'),
  })
  const state = makeThreadState([earlyText, attachment, laterText])

  deleteMessagesFromThreadState(state, {
    deletableMessageTypes: new Set<T.Chat.MessageType>(['text']),
    upToMessageID: T.Chat.numberToMessageID(503),
  })

  expect(state.messageMap.has(earlyText.ordinal)).toBe(false)
  expect(state.messageMap.has(attachment.ordinal)).toBe(true)
  expect(state.messageMap.has(laterText.ordinal)).toBe(true)
  expect(state.messageOrdinals).toEqual([attachment.ordinal, laterText.ordinal])
})

test('explodeMessagesInThreadState clears text content and transient metadata in place', () => {
  const state = makeThreadState([
    makeTextMessage({
      flipGameID: 'flip-game',
      mentionsAt: new Set(['bob']),
      reactions: new Map([[':+1:', makeReaction('bob', 5)]]),
      unfurls: new Map([['https://keybase.io', {} as T.RPCChat.UIMessageUnfurlInfo]]),
    }),
  ])

  explodeMessagesInThreadState(state, [msgID], 'bob')

  const message = state.messageMap.get(ordinal)
  expect(message?.type === 'text' ? message.text.stringValue() : undefined).toBe('')
  expect(message?.exploded).toBe(true)
  expect(message?.explodedBy).toBe('bob')
  expect(message?.type === 'text' ? message.flipGameID : undefined).toBe('')
  expect(message?.type === 'text' ? [...(message.mentionsAt ?? [])] : undefined).toEqual([])
  expect(message?.reactions?.size ?? 0).toBe(0)
  expect(message?.unfurls?.size ?? 0).toBe(0)
})

test('setMessageErroredInThreadState marks pending outbox rows as failed', () => {
  const pendingOrdinal = T.Chat.numberToOrdinal(10.001)
  const knownOutboxID = T.Chat.stringToOutboxID('known-outbox')
  const state = makeThreadState([
    makeTextMessage({
      id: T.Chat.numberToMessageID(0),
      ordinal: pendingOrdinal,
      outboxID: knownOutboxID,
      submitState: 'pending',
    }),
  ])

  setMessageErroredInThreadState(state, knownOutboxID, 'network fail', 7)
  setMessageErroredInThreadState(state, T.Chat.stringToOutboxID('missing-outbox'), 'ignored', 8)

  const message = state.messageMap.get(pendingOrdinal)
  expect(message?.submitState).toBe('failed')
  expect(message?.errorReason).toBe('network fail')
  expect(message?.errorTyp).toBe(7)
})

test('applyOptimisticReactionsToMessage overlays reactions without mutating server state', () => {
  const state = makeThreadState([makeTextMessage()])
  const message = state.messageMap.get(ordinal)

  const withReaction = applyOptimisticReactionsToMessage(
    message,
    new Map([
      [
        outboxID,
        {
          add: true,
          decorated: ':+1:',
          emoji: ':+1:',
          targetOrdinal: ordinal,
          timestamp: 10,
          username: 'alice',
        },
      ],
    ])
  )

  expect(withReaction?.reactions?.get(':+1:')?.users).toEqual([
    {timestamp: 10, username: 'alice'},
  ])
  expect(message?.reactions).toBeUndefined()

  const withoutReaction = applyOptimisticReactionsToMessage(
    makeTextMessage({reactions: new Map([[':+1:', makeReaction('alice', 50)]])}),
    new Map([
      [
        outboxID,
        {
          add: false,
          decorated: ':+1:',
          emoji: ':+1:',
          targetOrdinal: ordinal,
          timestamp: 11,
          username: 'alice',
        },
      ],
    ])
  )
  expect(withoutReaction?.reactions).toBeUndefined()
})

test('updateReactionsInThreadState keeps existing emoji order and reports missing targets', () => {
  const state = makeThreadState([
    makeTextMessage({
      reactions: new Map([
        [':+1:', makeReaction('alice', 50)],
        [':wave:', makeReaction('bob', 60)],
      ]),
    }),
  ])
  const reactions = new Map([
    [':fire:', makeReaction('carol', 70)],
    [':+1:', makeReaction('alice', 30)],
    [':wave:', makeReaction('bob', 80)],
    [':eyes:', makeReaction('dave', 40)],
  ])

  const missing = updateReactionsInThreadState(state, [
    {reactions, targetMsgID: msgID},
    {reactions, targetMsgID: T.Chat.numberToMessageID(999)},
  ])

  const message = state.messageMap.get(ordinal)
  expect(Message.getReactionOrder(message?.reactions ?? new Map())).toEqual([
    ':+1:',
    ':eyes:',
    ':fire:',
    ':wave:',
  ])
  expect([...(message?.reactions?.keys() ?? [])]).toEqual([':+1:', ':wave:', ':eyes:', ':fire:'])
  expect(missing).toEqual([T.Chat.numberToMessageID(999)])
})

test('clearOptimisticReactionsForUpdatesInThreadState drops overlay once server state arrives', () => {
  const reactions = new Map([[':+1:', makeReaction('bob', 30)]])
  const state: WritableConversationThreadOptimisticState = {
    ...makeThreadState([makeTextMessage()]),
    optimisticReactionMap: new Map([
      [
        outboxID,
        {
          add: true,
          decorated: ':+1:',
          emoji: ':+1:',
          targetOrdinal: ordinal,
          timestamp: 10,
          username: 'alice',
        },
      ],
    ]),
  }

  updateReactionsInThreadState(state, [{reactions, targetMsgID: msgID}])
  clearOptimisticReactionsForUpdatesInThreadState(state, [{reactions, targetMsgID: msgID}])

  expect(state.optimisticReactionMap.size).toBe(0)
  expect(state.messageMap.get(ordinal)?.reactions?.get(':+1:')?.users).toEqual([
    {timestamp: 30, username: 'bob'},
  ])
})

describe('addMessagesToThreadState', () => {
  const textAt = (
    ord: number,
    override?: Omit<Partial<T.Chat.MessageText>, 'text'> & {text?: string}
  ) =>
    makeTextMessage({
      id: T.Chat.numberToMessageID(ord),
      ordinal: T.Chat.numberToOrdinal(ord),
      outboxID: undefined,
      ...override,
    })

  test('keeps the ordinal list sorted no matter what order messages arrive in', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(30), textAt(10), textAt(20)], {})
    expect(state.messageOrdinals).toEqual([10, 20, 30])
    addMessagesToThreadState(state, [textAt(15)], {})
    expect(state.messageOrdinals).toEqual([10, 15, 20, 30])
  })

  test('re-adding the same message does not duplicate its ordinal', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10)], {})
    const before = state.messageOrdinals
    addMessagesToThreadState(state, [textAt(10, {text: 'edited'})], {})
    expect(state.messageOrdinals).toEqual([10])
    // nothing changed in the list, so the identity is kept for subscribers
    expect(state.messageOrdinals).toBe(before)
    expect(state.messageMap.get(T.Chat.numberToOrdinal(10))?.type).toBe('text')
  })

  test('the sent message lands on its pending ordinal so the row does not jump', () => {
    const pendingOrdinal = T.Chat.numberToOrdinal(10.001)
    const pending = makeTextMessage({
      id: T.Chat.numberToMessageID(0),
      ordinal: pendingOrdinal,
      outboxID,
      submitState: 'pending',
    })
    const state = makeThreadState([pending])

    const sent = makeTextMessage({
      id: T.Chat.numberToMessageID(300),
      ordinal: T.Chat.numberToOrdinal(300),
      outboxID,
      submitState: undefined,
    })
    addMessagesToThreadState(state, [sent], {})

    expect(state.messageOrdinals).toEqual([pendingOrdinal])
    expect(state.messageMap.get(pendingOrdinal)?.id).toBe(300)
    expect(state.messageMap.get(T.Chat.numberToOrdinal(300))).toBeUndefined()
    expect(state.messageIDToOrdinal.get(T.Chat.numberToMessageID(300))).toBe(pendingOrdinal)
  })

  test('an edit arriving by message id updates the existing row in place', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10)], {})
    addMessagesToThreadState(state, [textAt(10, {text: 'edited'})], {})
    expect(state.messageMap.get(T.Chat.numberToOrdinal(10))?.type).toBe('text')
    expect(
      (state.messageMap.get(T.Chat.numberToOrdinal(10)) as T.Chat.MessageText).text.stringValue()
    ).toBe('edited')
  })

  test('deleted messages drop out of the thread entirely', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10), textAt(20)], {})
    const deleted = Message.makeMessageDeleted({
      conversationIDKey: convID,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
    })
    addMessagesToThreadState(state, [deleted], {})
    expect(state.messageOrdinals).toEqual([20])
    expect(state.messageMap.has(T.Chat.numberToOrdinal(10))).toBe(false)
    expect(state.messageIDToOrdinal.has(T.Chat.numberToMessageID(10))).toBe(false)
  })

  test('a placeholder never clobbers a real message', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10)], {})
    const placeholder = Message.makeMessagePlaceholder({
      conversationIDKey: convID,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
    })
    addMessagesToThreadState(state, [placeholder], {})
    expect(state.messageMap.get(T.Chat.numberToOrdinal(10))?.type).toBe('text')
  })

  test('non conversation messages are stored but stay out of the thread list', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10), textAt(20, {conversationMessage: false})], {})
    expect(state.messageOrdinals).toEqual([10])
    expect(state.messageMap.has(T.Chat.numberToOrdinal(20))).toBe(true)
  })

  test('a validated range prunes local ordinals the service did not send back', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10), textAt(20), textAt(30)], {})
    addMessagesToThreadState(state, [textAt(10), textAt(30)], {
      validatedRange: {from: T.Chat.numberToOrdinal(10), to: T.Chat.numberToOrdinal(30)},
    })
    expect(state.messageOrdinals).toEqual([10, 30])
    expect(state.messageMap.has(T.Chat.numberToOrdinal(20))).toBe(false)
    expect(state.validatedOrdinalRange).toEqual({from: 10, to: 30})
  })

  test('a validated range leaves ordinals outside of it alone and widens the known range', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10), textAt(50)], {})
    addMessagesToThreadState(state, [textAt(50)], {
      validatedRange: {from: T.Chat.numberToOrdinal(40), to: T.Chat.numberToOrdinal(60)},
    })
    expect(state.messageOrdinals).toEqual([10, 50])
    addMessagesToThreadState(state, [textAt(10)], {
      validatedRange: {from: T.Chat.numberToOrdinal(5), to: T.Chat.numberToOrdinal(15)},
    })
    expect(state.validatedOrdinalRange).toEqual({from: 5, to: 60})
  })

  test('a notification may not strand a new ordinal below the loaded window', () => {
    // The post-load ResolveSkippedUnboxeds push can carry the channel-name message at ID 1 long
    // after the window has moved on. Adding it puts an orphan row at index 0 and breaks scrollback.
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(7152), textAt(7153)], {})
    addMessagesToThreadState(state, [textAt(1)], {dropNewBelowWindow: true})
    expect(state.messageOrdinals).toEqual([7152, 7153])
  })

  test('a notification still updates a message already inside the window', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10), textAt(20)], {})
    addMessagesToThreadState(state, [textAt(10, {text: 'edited'})], {dropNewBelowWindow: true})
    expect(state.messageOrdinals).toEqual([10, 20])
    const m = state.messageMap.get(T.Chat.numberToOrdinal(10))
    expect(m?.type === 'text' ? m.text.stringValue() : undefined).toBe('edited')
  })

  test('a notification may still append a new ordinal above the window', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(10), textAt(20)], {})
    addMessagesToThreadState(state, [textAt(21)], {dropNewBelowWindow: true})
    expect(state.messageOrdinals).toEqual([10, 20, 21])
  })

  test('a thread load may still extend the window downward', () => {
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(7152), textAt(7153)], {})
    addMessagesToThreadState(state, [textAt(7038)], {})
    expect(state.messageOrdinals).toEqual([7038, 7152, 7153])
  })

  test('a superseded placeholder does not strand its own ordinal in the list', () => {
    // A sent message keeps the fractional ordinal it had in the outbox, so a later placeholder for
    // the same message ID maps onto that fractional ordinal, not its own integer one.
    const state = makeThreadState([])
    addMessagesToThreadState(
      state,
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(100),
          ordinal: T.Chat.numberToOrdinal(100.001),
          outboxID: undefined,
        }),
      ],
      {}
    )
    expect(state.messageOrdinals).toEqual([100.001])
    addMessagesToThreadState(
      state,
      [
        Message.makeMessagePlaceholder({
          conversationIDKey: convID,
          id: T.Chat.numberToMessageID(100),
          ordinal: T.Chat.numberToOrdinal(100),
        }),
      ],
      {}
    )
    expect(state.messageOrdinals).toEqual([100.001])
    expect(state.messageMap.has(T.Chat.numberToOrdinal(100))).toBe(false)
  })

  test('the render type index only tracks non text messages', () => {
    const state = makeThreadState([])
    const attachment = makeAttachmentMessage({ordinal: T.Chat.numberToOrdinal(20), outboxID: undefined})
    addMessagesToThreadState(state, [textAt(10), attachment], {})
    expect(state.messageTypeMap.has(T.Chat.numberToOrdinal(10))).toBe(false)
    expect(state.messageTypeMap.get(T.Chat.numberToOrdinal(20))).toBe('attachment:file')
  })

  test('a placeholder for a message we already hold does not get it pruned', () => {
    // Regression: the placeholder bailed out of incomingOrdinals bookkeeping, so the validatedRange
    // prune saw its ordinal as absent from the response and deleted the real message underneath.
    // A quick-mode Pull returns a placeholder for anything it could not unbox, so this is the
    // ordinary shape of a focused refresh, not an edge case.
    const state = makeThreadState([textAt(49), textAt(50), textAt(51)])
    addMessagesToThreadState(
      state,
      [textAt(49), Message.makeMessagePlaceholder({ordinal: T.Chat.numberToOrdinal(50)}), textAt(51)],
      {validatedRange: {from: T.Chat.numberToOrdinal(49), to: T.Chat.numberToOrdinal(51)}}
    )
    expect(state.messageOrdinals).toEqual([
      T.Chat.numberToOrdinal(49),
      T.Chat.numberToOrdinal(50),
      T.Chat.numberToOrdinal(51),
    ])
    expect(state.messageMap.get(T.Chat.numberToOrdinal(50))?.type).toEqual('text')
  })

  test('a message dropped below the window leaves nothing behind in the maps', () => {
    const state = makeThreadState([textAt(7152), textAt(7153)])
    addMessagesToThreadState(state, [textAt(1)], {dropNewBelowWindow: true})

    expect(state.messageOrdinals).toEqual([
      T.Chat.numberToOrdinal(7152),
      T.Chat.numberToOrdinal(7153),
    ])
    // The ordinal is not in the list, so nothing may still point at it. An entry left in these maps
    // makes getOrdinalForMessageID hand out an ordinal with no row, and callers act on a message the
    // thread is not showing.
    expect(state.messageMap.has(T.Chat.numberToOrdinal(1))).toBe(false)
    expect(state.messageIDToOrdinal.has(T.Chat.numberToMessageID(1))).toBe(false)
    expect(state.messageTypeMap.has(T.Chat.numberToOrdinal(1))).toBe(false)
  })

  test('a message dropped below the window does not disturb one already in the window', () => {
    const state = makeThreadState([textAt(7152), textAt(7153)])
    addMessagesToThreadState(state, [textAt(1), textAt(7152)], {dropNewBelowWindow: true})

    expect(state.messageOrdinals).toEqual([
      T.Chat.numberToOrdinal(7152),
      T.Chat.numberToOrdinal(7153),
    ])
    expect(state.messageMap.has(T.Chat.numberToOrdinal(1))).toBe(false)
    expect(state.messageMap.has(T.Chat.numberToOrdinal(7152))).toBe(true)
    expect(state.messageIDToOrdinal.get(T.Chat.numberToMessageID(7152))).toEqual(
      T.Chat.numberToOrdinal(7152)
    )
  })

  test('a message newer than the window is dropped while there is more to load forward', () => {
    // A centered jump - a search result - leaves a contiguous window with more on both sides of it.
    // A push newer than the ceiling has a hole under it just as a below-floor one has a hole over
    // it, and paging forward is what fills that hole.
    const state = makeThreadState([textAt(7152), textAt(7153)], {moreToLoadForward: true})
    addMessagesToThreadState(state, [textAt(9001)], {dropNewBelowWindow: true})

    expect(state.messageOrdinals).toEqual([T.Chat.numberToOrdinal(7152), T.Chat.numberToOrdinal(7153)])
    expect(state.messageMap.has(T.Chat.numberToOrdinal(9001))).toBe(false)
  })

  test('a message newer than the window appends once the window reaches the newest message', () => {
    // The ordinary live path: the window contains the latest message, so there is no hole to open
    // above it and an incoming message must land.
    const state = makeThreadState([textAt(7152), textAt(7153)], {moreToLoadForward: false})
    addMessagesToThreadState(state, [textAt(9001)], {dropNewBelowWindow: true})

    expect(state.messageOrdinals).toEqual([
      T.Chat.numberToOrdinal(7152),
      T.Chat.numberToOrdinal(7153),
      T.Chat.numberToOrdinal(9001),
    ])
  })

  test('a cleared window still refuses a notification below the floor it had', () => {
    // messagesClear wipes messageOrdinals but remembers the window, because jumpToRecent and a
    // centered jump both clear then reload. A push landing in that gap would otherwise face an
    // empty window, install itself as the whole of it, and strand once the load response arrives.
    const state = makeThreadState([])
    state.clearedWindow = {floor: T.Chat.numberToOrdinal(7152)}
    addMessagesToThreadState(state, [textAt(1)], {dropNewBelowWindow: true})
    expect(state.messageOrdinals ?? []).toEqual([])

    // ...and the load that follows populates it normally.
    addMessagesToThreadState(state, [textAt(9001)], {})
    expect(state.messageOrdinals).toEqual([T.Chat.numberToOrdinal(9001)])
  })

  test('a window cleared for jump-to-recent keeps a notification above the floor it had', () => {
    // The reload lands newer than the old floor, so a message arriving first belongs in what is
    // coming - the response may have been composed before it existed. Dropping it would lose it.
    const state = makeThreadState([])
    state.clearedWindow = {floor: T.Chat.numberToOrdinal(7152)}
    addMessagesToThreadState(state, [textAt(9001)], {dropNewBelowWindow: true})
    expect(state.messageOrdinals).toEqual([T.Chat.numberToOrdinal(9001)])
  })

  test('a window cleared for a centered jump refuses a notification in either direction', () => {
    // The reload lands on an arbitrary region, so nothing arriving first can be placed against it -
    // above the coming window strands as surely as below it.
    const state = makeThreadState([])
    state.clearedWindow = {dropAll: true, floor: T.Chat.numberToOrdinal(7152)}
    addMessagesToThreadState(state, [textAt(1), textAt(9001)], {dropNewBelowWindow: true})
    expect(state.messageOrdinals ?? []).toEqual([])

    // The centered load itself is not a push, so it fills the window as usual.
    addMessagesToThreadState(state, [textAt(120), textAt(121)], {})
    expect(state.messageOrdinals).toEqual([T.Chat.numberToOrdinal(120), T.Chat.numberToOrdinal(121)])
  })

  test('with no window and no remembered floor a notification still applies', () => {
    // A conversation that has never held a window - a first load, or one that is genuinely empty.
    // There is no floor to be below, so nothing is dropped and a new message appears at once.
    const state = makeThreadState([])
    addMessagesToThreadState(state, [textAt(1)], {dropNewBelowWindow: true})
    expect(state.messageOrdinals).toEqual([T.Chat.numberToOrdinal(1)])
  })
})
