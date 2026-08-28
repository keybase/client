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

  test('the render type index only tracks non text messages', () => {
    const state = makeThreadState([])
    const attachment = makeAttachmentMessage({ordinal: T.Chat.numberToOrdinal(20), outboxID: undefined})
    addMessagesToThreadState(state, [textAt(10), attachment], {})
    expect(state.messageTypeMap.has(T.Chat.numberToOrdinal(10))).toBe(false)
    expect(state.messageTypeMap.get(T.Chat.numberToOrdinal(20))).toBe('attachment:file')
  })
})
