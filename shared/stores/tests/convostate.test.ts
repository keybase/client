/// <reference types="jest" />
import * as Meta from '../../constants/chat/meta'
import * as Message from '../../constants/chat/message'
import * as T from '../../constants/types'
import HiddenString from '../../util/hidden-string'
import {useCurrentUserState} from '../current-user'
import {createConvoStoreForTesting, type ConvoState} from '../convostate'

jest.mock('../inbox-rows', () => ({
  queueInboxRowUpdate: jest.fn(),
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const ordinal = T.Chat.numberToOrdinal(10)
const msgID = T.Chat.numberToMessageID(101)
const outboxID = T.Chat.stringToOutboxID('outbox-1')

useCurrentUserState.getState().dispatch.setBootstrap({
  deviceID: 'device-id',
  deviceName: 'test-device',
  uid: 'uid',
  username: 'alice',
})

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

const makePendingTextMessage = (pendingOrdinal: T.Chat.Ordinal, pendingOutboxID: T.Chat.OutboxID, text: string) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    ordinal: pendingOrdinal,
    outboxID: pendingOutboxID,
    submitState: 'pending',
    text: new HiddenString(text),
    timestamp: 50,
  })

const makeValidTextUIMessage = (
  serverMsgID: T.Chat.MessageID,
  text: string,
  options?: {
    author?: string
    outboxID?: T.Chat.OutboxID
    timestamp?: number
  }
): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: {
    atMentions: null,
    bodySummary: text,
    botUsername: '',
    channelMention: T.RPCChat.ChannelMention.none,
    channelNameMentions: null,
    ctime: options?.timestamp ?? 200,
    decoratedTextBody: null,
    etime: 0,
    explodedBy: null,
    hasPairwiseMacs: false,
    isCollapsed: false,
    isDeleteable: true,
    isEditable: true,
    isEphemeral: false,
    isEphemeralExpired: false,
    messageBody: {
      messageType: T.RPCChat.MessageType.text,
      text: {
        body: text,
        payments: null,
        replyTo: null,
        replyToUID: null,
        teamMentions: null,
        userMentions: null,
      },
    },
    messageID: T.Chat.messageIDToNumber(serverMsgID),
    outboxID: T.Chat.outboxIDToString(options?.outboxID ?? T.Chat.stringToOutboxID('')),
    paymentInfos: null,
    pinnedMessageID: null,
    reactions: {},
    replyTo: null,
    requestInfo: null,
    senderDeviceID: new Uint8Array([1]),
    senderDeviceName: `${options?.author ?? 'alice'}-device`,
    senderDeviceRevokedAt: null,
    senderDeviceType: 'desktop',
    senderUID: new Uint8Array([2]),
    senderUsername: options?.author ?? 'alice',
    superseded: false,
    unfurls: null,
  },
})

const makePlaceholderUIMessage = (messageID: T.Chat.MessageID, hidden = false): T.RPCChat.UIMessage =>
  ({
    placeholder: {
      hidden,
      messageID: T.Chat.messageIDToNumber(messageID),
    },
    state: T.RPCChat.MessageUnboxedState.placeholder,
  }) as T.RPCChat.UIMessage

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

const makeMeta = (override?: Partial<T.Chat.ConversationMeta>) => ({
  ...Meta.makeConversationMeta(),
  conversationIDKey: convID,
  maxVisibleMsgID: msgID,
  readMsgID: T.Chat.numberToMessageID(0),
  ...override,
})

test('getReactionOrder sorts emojis by earliest reaction timestamp', () => {
  const reactions = new Map([
    [':fire:', makeReaction('carol', 70)],
    [
      ':+1:',
      {
        decorated: ':+1:',
        users: [
          {timestamp: 50, username: 'alice'},
          {timestamp: 30, username: 'bob'},
        ],
      },
    ],
    [':wave:', makeReaction('bob', 60)],
    [':eyes:', makeReaction('dave', 40)],
  ])

  expect(Message.getReactionOrder(reactions)).toEqual([':+1:', ':eyes:', ':wave:', ':fire:'])
})

const applyState = (
  store: {getState: () => any; setState: (state: any) => void},
  partial: Partial<ConvoState> & {messageIDToOrdinal?: ReadonlyMap<T.Chat.MessageID, T.Chat.Ordinal>}
) => {
  const current = store.getState()
  store.setState({
    ...current,
    ...partial,
    dispatch: current.dispatch,
    getConvID: current.getConvID,
    isCaughtUp: current.isCaughtUp,
    isMetaGood: current.isMetaGood,
  })
}

const createStore = () => createConvoStoreForTesting(convID)

const seedStore = (
  messages: ReadonlyArray<T.Chat.Message>,
  extra?: Partial<ConvoState> & {
    messageIDToOrdinal?: ReadonlyMap<T.Chat.MessageID, T.Chat.Ordinal>
    pendingOutboxToOrdinal?: ReadonlyMap<T.Chat.OutboxID, T.Chat.Ordinal>
  }
) => {
  const store = createStore()
  const sortedMessages = [...messages].sort((a, b) => a.ordinal - b.ordinal)
  const messageMap = new Map(sortedMessages.map(message => [message.ordinal, message]))
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
  applyState(store, {
    loaded: true,
    messageIDToOrdinal,
    messageMap,
    messageOrdinals,
    messageTypeMap,
    meta: makeMeta(),
    pendingOutboxToOrdinal,
    reactionOrderMap: new Map(),
    separatorMap: new Map(),
    showUsernameMap: new Map(),
    ...extra,
  })
  return store
}

const seedStoreWithAnchoredMessage = () => {
  const store = createStore()
  const message = makeTextMessage()
  const baseState: Partial<ConvoState> = {
    loaded: true,
    messageMap: new Map([[ordinal, message]]),
    messageOrdinals: [ordinal],
    messageTypeMap: new Map(),
    meta: makeMeta(),
    pendingOutboxToOrdinal: new Map([[outboxID, ordinal]]),
    reactionOrderMap: new Map(),
    separatorMap: new Map([[ordinal, T.Chat.numberToOrdinal(0)]]),
    showUsernameMap: new Map([[ordinal, 'alice']]),
  }
  applyState(store, {
    ...baseState,
    messageIDToOrdinal: new Map([[msgID, ordinal]]),
  })
  return store
}

test('testing store starts with initial state and helper selectors', () => {
  const store = createStore()
  const state = store.getState()
  expect(state.id).toBe(convID)
  expect(state.loaded).toBe(false)
  expect(state.messageMap.size).toBe(0)
  expect(state.messageOrdinals).toBeUndefined()
  expect(state.getConvID()).toEqual(T.Chat.keyToConversationID(convID))
  expect(state.isCaughtUp()).toBe(true)
  expect(state.isMetaGood()).toBe(false)
})

test('onMessagesUpdated adds messages and recomputes derived thread maps', () => {
  const store = createStore()
  const firstMsgID = T.Chat.numberToMessageID(301)
  const secondMsgID = T.Chat.numberToMessageID(302)

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [
      makeValidTextUIMessage(firstMsgID, 'first', {author: 'bob', timestamp: 100}),
      makeValidTextUIMessage(secondMsgID, 'second', {author: 'bob', timestamp: 101}),
    ],
  })

  expect(store.getState().messageOrdinals).toEqual([
    T.Chat.numberToOrdinal(301),
    T.Chat.numberToOrdinal(302),
  ])
  expect(store.getState().messageIDToOrdinal.get(firstMsgID)).toBe(T.Chat.numberToOrdinal(301))
  expect(store.getState().separatorMap.get(T.Chat.numberToOrdinal(301))).toBe(T.Chat.numberToOrdinal(0))
  expect(store.getState().separatorMap.get(T.Chat.numberToOrdinal(302))).toBe(T.Chat.numberToOrdinal(301))
  expect(store.getState().showUsernameMap.get(T.Chat.numberToOrdinal(301))).toBe('bob')
  expect(store.getState().showUsernameMap.get(T.Chat.numberToOrdinal(302))).toBe('')
  expect(store.getState().messageTypeMap.size).toBe(0)
})

test('message updates refresh derived metadata for the following row', () => {
  const firstOrdinal = T.Chat.numberToOrdinal(301)
  const secondOrdinal = T.Chat.numberToOrdinal(302)
  const firstMsgID = T.Chat.numberToMessageID(301)
  const store = seedStore([
    makeTextMessage({
      author: 'bob',
      id: firstMsgID,
      ordinal: firstOrdinal,
      outboxID: T.Chat.stringToOutboxID('first'),
      timestamp: 100,
    }),
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(302),
      ordinal: secondOrdinal,
      outboxID: T.Chat.stringToOutboxID('second'),
      timestamp: 101,
    }),
  ])

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makeValidTextUIMessage(firstMsgID, 'edited first', {author: 'alice', timestamp: 100})],
  })

  expect(store.getState().showUsernameMap.get(firstOrdinal)).toBe('alice')
  expect(store.getState().showUsernameMap.get(secondOrdinal)).toBe('bob')
  expect(store.getState().separatorMap.get(secondOrdinal)).toBe(firstOrdinal)
})

test('reaction updates preserve outbox-anchored row identity', () => {
  const store = seedStoreWithAnchoredMessage()
  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])
  store.getState().dispatch.updateReactions([{reactions, targetMsgID: msgID}])
  expect(store.getState().reactionOrderMap.get(ordinal)?.[0]).toBe(':+1:')
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
})

test('reaction updates keep existing emoji order and sort new emojis by first timestamp', () => {
  const store = seedStore([
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

  store.getState().dispatch.updateReactions([{reactions, targetMsgID: msgID}])

  expect(store.getState().reactionOrderMap.get(ordinal)).toEqual([':+1:', ':eyes:', ':fire:', ':wave:'])
  const message = store.getState().messageMap.get(ordinal)
  expect(Message.isMessageWithReactions(message!)).toBe(true)
  if (message && Message.isMessageWithReactions(message)) {
    expect([...(message.reactions?.keys() ?? [])]).toEqual([':+1:', ':wave:', ':eyes:', ':fire:'])
  }
})

test('reaction updates clear message reactions when the server sends none', () => {
  const store = seedStore([makeTextMessage({reactions: new Map([[':+1:', makeReaction('bob', 5)]])})])
  store.getState().dispatch.updateReactions([{targetMsgID: msgID}])
  const message = store.getState().messageMap.get(ordinal)
  expect(message && Message.isMessageWithReactions(message) ? message.reactions : undefined).toBeUndefined()
  expect(store.getState().reactionOrderMap.get(ordinal)).toEqual([])
})

test('reaction updates ignore deleted and placeholder rows', () => {
  const deletedMsgID = T.Chat.numberToMessageID(401)
  const placeholderMsgID = T.Chat.numberToMessageID(402)
  const store = seedStore([
    Message.makeMessageDeleted({
      author: 'alice',
      conversationIDKey: convID,
      id: deletedMsgID,
      ordinal: T.Chat.numberToOrdinal(401),
    }),
    Message.makeMessagePlaceholder({
      conversationIDKey: convID,
      id: placeholderMsgID,
      ordinal: T.Chat.numberToOrdinal(402),
    }),
  ])
  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])

  store.getState().dispatch.updateReactions([
    {reactions, targetMsgID: deletedMsgID},
    {reactions, targetMsgID: placeholderMsgID},
  ])

  expect(store.getState().reactionOrderMap.size).toBe(0)
  expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(401))?.type).toBe('deleted')
  expect(store.getState().messageMap.get(T.Chat.numberToOrdinal(402))?.type).toBe('placeholder')
})

test('message deletion removes the row but preserves the outbox anchor', () => {
  const store = seedStoreWithAnchoredMessage()
  store.getState().dispatch.messagesWereDeleted({messageIDs: [msgID]})
  expect(store.getState().messageMap.has(ordinal)).toBe(false)
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
  expect(store.getState().messageIDToOrdinal.has(msgID)).toBe(false)
})

test('message deletion refreshes derived metadata for the next row', () => {
  const firstOrdinal = T.Chat.numberToOrdinal(401)
  const secondOrdinal = T.Chat.numberToOrdinal(402)
  const store = seedStore([
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(401),
      ordinal: firstOrdinal,
      outboxID: T.Chat.stringToOutboxID('first-delete'),
      timestamp: 100,
    }),
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(402),
      ordinal: secondOrdinal,
      outboxID: T.Chat.stringToOutboxID('second-delete'),
      timestamp: 101,
    }),
  ])

  store.getState().dispatch.messagesWereDeleted({ordinals: [firstOrdinal]})

  expect(store.getState().messageOrdinals).toEqual([secondOrdinal])
  expect(store.getState().separatorMap.has(firstOrdinal)).toBe(false)
  expect(store.getState().showUsernameMap.get(secondOrdinal)).toBe('bob')
  expect(store.getState().separatorMap.get(secondOrdinal)).toBe(T.Chat.numberToOrdinal(0))
})

test('message deletion up to a message ID honors deletable message types', () => {
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
  const store = seedStore([earlyText, attachment, laterText])

  store.getState().dispatch.messagesWereDeleted({
    deletableMessageTypes: new Set<T.Chat.MessageType>(['text']),
    upToMessageID: T.Chat.numberToMessageID(503),
  })

  expect(store.getState().messageMap.has(T.Chat.numberToOrdinal(501))).toBe(false)
  expect(store.getState().messageMap.has(T.Chat.numberToOrdinal(502))).toBe(true)
  expect(store.getState().messageMap.has(T.Chat.numberToOrdinal(503))).toBe(true)
  expect(store.getState().messageOrdinals).toEqual([T.Chat.numberToOrdinal(502), T.Chat.numberToOrdinal(503)])
})

test('explode-now clears text content and transient metadata in place', () => {
  const store = seedStore([
    makeTextMessage({
      flipGameID: 'flip-game',
      mentionsAt: new Set(['bob']),
      reactions: new Map([[':+1:', makeReaction('bob', 5)]]),
      unfurls: new Map([['https://keybase.io', {} as T.RPCChat.UIMessageUnfurlInfo]]),
    }),
  ])
  store.getState().dispatch.messagesExploded([msgID], 'bob')
  const state = store.getState()
  const message = state.messageMap.get(ordinal)
  expect(message?.type).toBe('text')
  expect(message?.type === 'text' ? message.text.stringValue() : undefined).toBe('')
  expect(message?.exploded).toBe(true)
  expect(message?.explodedBy).toBe('bob')
  expect(message?.type === 'text' ? message.flipGameID : undefined).toBe('')
  expect(message?.type === 'text' ? [...(message.mentionsAt ?? [])] : undefined).toEqual([])
  expect(message?.reactions?.size ?? 0).toBe(0)
  expect(message?.unfurls?.size ?? 0).toBe(0)
  expect(state.reactionOrderMap.get(ordinal)).toEqual([])
})

test('messagesClear resets all message indexes and maps', () => {
  const store = seedStoreWithAnchoredMessage()
  applyState(store, {
    loaded: true,
    reactionOrderMap: new Map([[ordinal, [':+1:']]]),
    separatorMap: new Map([[ordinal, T.Chat.numberToOrdinal(0)]]),
    showUsernameMap: new Map([[ordinal, 'alice']]),
    validatedOrdinalRange: {from: ordinal, to: ordinal},
  })
  store.getState().dispatch.messagesClear()
  expect(store.getState().loaded).toBe(false)
  expect(store.getState().messageMap.size).toBe(0)
  expect(store.getState().messageOrdinals).toBeUndefined()
  expect(store.getState().messageTypeMap.size).toBe(0)
  expect(store.getState().pendingOutboxToOrdinal.size).toBe(0)
  expect(store.getState().messageIDToOrdinal.size).toBe(0)
  expect(store.getState().reactionOrderMap.size).toBe(0)
  expect(store.getState().separatorMap.size).toBe(0)
  expect(store.getState().showUsernameMap.size).toBe(0)
  expect(store.getState().validatedOrdinalRange).toBeUndefined()
})

test('server ack preserves the outbox-anchored ordinal and later msgID lookups hit that row', () => {
  const store = createStore()
  const pendingOrdinal = T.Chat.numberToOrdinal(10.001)
  const serverMsgID = T.Chat.numberToMessageID(202)
  const pendingMessage = makePendingTextMessage(pendingOrdinal, outboxID, 'pending hello')
  const baseState: Partial<ConvoState> = {
    loaded: true,
    messageMap: new Map([[pendingOrdinal, pendingMessage]]),
    messageOrdinals: [pendingOrdinal],
    messageTypeMap: new Map(),
    meta: makeMeta(),
    pendingOutboxToOrdinal: new Map([[outboxID, pendingOrdinal]]),
    reactionOrderMap: new Map(),
    separatorMap: new Map([[pendingOrdinal, T.Chat.numberToOrdinal(0)]]),
    showUsernameMap: new Map([[pendingOrdinal, 'alice']]),
  }
  applyState(store, baseState)

  const ack = makeValidTextUIMessage(serverMsgID, 'acked hello', {outboxID})
  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [ack],
  })

  const ackedMessage = store.getState().messageMap.get(pendingOrdinal)
  expect(store.getState().messageOrdinals).toEqual([pendingOrdinal])
  expect(ackedMessage?.id).toBe(serverMsgID)
  expect(ackedMessage?.type === 'text' ? ackedMessage.text.stringValue() : undefined).toBe('acked hello')
  expect(store.getState().messageIDToOrdinal.get(serverMsgID)).toBe(pendingOrdinal)

  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])
  store.getState().dispatch.updateReactions([{reactions, targetMsgID: serverMsgID}])

  expect(store.getState().reactionOrderMap.get(pendingOrdinal)?.[0]).toBe(':+1:')

  store.getState().dispatch.messagesWereDeleted({messageIDs: [serverMsgID]})

  expect(store.getState().messageMap.has(pendingOrdinal)).toBe(false)
  expect(store.getState().messageIDToOrdinal.has(serverMsgID)).toBe(false)
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(pendingOrdinal)
})

test('placeholder updates do not overwrite an existing non-placeholder message', () => {
  const placeholderOrdinal = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(msgID))
  const store = seedStore([
    makeTextMessage({
      id: msgID,
      ordinal: placeholderOrdinal,
      outboxID: T.Chat.stringToOutboxID('existing-message'),
      text: 'kept text',
    }),
  ])

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makePlaceholderUIMessage(msgID)],
  })

  const message = store.getState().messageMap.get(placeholderOrdinal)
  expect(message?.type).toBe('text')
  expect(message?.type === 'text' ? message.text.stringValue() : undefined).toBe('kept text')
})

test('hidden placeholder updates delete the existing message row', () => {
  const hiddenMsgID = T.Chat.numberToMessageID(601)
  const hiddenOrdinal = T.Chat.numberToOrdinal(601)
  const store = seedStore([
    makeTextMessage({
      id: hiddenMsgID,
      ordinal: hiddenOrdinal,
      outboxID: T.Chat.stringToOutboxID('hidden-existing'),
    }),
  ])

  store.getState().dispatch.onMessagesUpdated({
    convID: T.Chat.keyToConversationID(convID),
    updates: [makePlaceholderUIMessage(hiddenMsgID, true)],
  })

  expect(store.getState().messageMap.has(hiddenOrdinal)).toBe(false)
  expect(store.getState().messageOrdinals).toEqual([])
  expect(store.getState().messageIDToOrdinal.has(hiddenMsgID)).toBe(false)
})

test('onMessageErrored marks the pending message as failed and leaves unknown outbox IDs alone', () => {
  const pendingOrdinal = T.Chat.numberToOrdinal(10.001)
  const knownOutboxID = T.Chat.stringToOutboxID('known-outbox')
  const store = seedStore([makePendingTextMessage(pendingOrdinal, knownOutboxID, 'pending')])

  store.getState().dispatch.onMessageErrored(knownOutboxID, 'network fail', 7)
  store.getState().dispatch.onMessageErrored(T.Chat.stringToOutboxID('missing-outbox'), 'ignored', 8)

  const message = store.getState().messageMap.get(pendingOrdinal)
  expect(message?.submitState).toBe('failed')
  expect(message?.errorReason).toBe('network fail')
  expect(message?.errorTyp).toBe(7)
})

test('setEditing last picks the latest editable local message and injects its content', () => {
  const attachmentOrdinal = T.Chat.numberToOrdinal(703)
  const store = seedStore([
    makeTextMessage({
      author: 'bob',
      id: T.Chat.numberToMessageID(701),
      ordinal: T.Chat.numberToOrdinal(701),
      outboxID: T.Chat.stringToOutboxID('someone-else'),
    }),
    makeTextMessage({
      exploded: true,
      id: T.Chat.numberToMessageID(702),
      ordinal: T.Chat.numberToOrdinal(702),
      outboxID: T.Chat.stringToOutboxID('exploded-self'),
      text: 'ignore me',
    }),
    makeAttachmentMessage({
      id: T.Chat.numberToMessageID(703),
      ordinal: attachmentOrdinal,
      outboxID: T.Chat.stringToOutboxID('editable-attachment'),
      title: 'picked attachment title',
    }),
  ])

  store.getState().dispatch.setEditing('last')

  expect(store.getState().editing).toBe(attachmentOrdinal)
  expect(store.getState().unsentText).toBe('picked attachment title')
})

test('setEditing clear resets editing state and clears unsent text', () => {
  const store = createStore()
  applyState(store, {
    editing: ordinal,
    unsentText: 'draft text',
  })

  store.getState().dispatch.setEditing('clear')

  expect(store.getState().editing).toBe(T.Chat.numberToOrdinal(0))
  expect(store.getState().unsentText).toBe('')
})

test('setMeta adopts the server draft once when the meta becomes good', () => {
  const store = createStore()

  store.getState().dispatch.setMeta(makeMeta({draft: 'server draft'}))
  expect(store.getState().isMetaGood()).toBe(true)
  expect(store.getState().unsentText).toBe('server draft')

  store.getState().dispatch.injectIntoInput('local draft')
  store.getState().dispatch.setMeta(makeMeta({draft: 'new server draft'}))

  expect(store.getState().unsentText).toBe('local draft')
})

test('local setters update participants, reply target, search query, and badge', () => {
  const store = createStore()
  const participants: ConvoState['participants'] = {
    all: ['alice', 'bob'],
    contactName: new Map([['bob', 'Bobby']]),
    name: ['alice', 'bob'],
  }

  store.getState().dispatch.setParticipants(participants)
  store.getState().dispatch.setReplyTo(ordinal)
  store.getState().dispatch.setThreadSearchQuery('hello world')
  store.getState().dispatch.badgesUpdated(3)

  expect(store.getState().participants).toEqual(participants)
  expect(store.getState().replyTo).toBe(ordinal)
  expect(store.getState().threadSearchQuery).toBe('hello world')
  expect(store.getState().badge).toBe(3)
})

test('toggleThreadSearch resets hits and removes center highlight when opening search', () => {
  const store = createStore()
  applyState(store, {
    messageCenterOrdinal: {highlightMode: 'always', ordinal},
    threadSearchInfo: {
      hits: [makeTextMessage()],
      status: 'done',
      visible: false,
    },
  })

  store.getState().dispatch.toggleThreadSearch()

  expect(store.getState().threadSearchInfo.visible).toBe(true)
  expect(store.getState().threadSearchInfo.hits).toEqual([])
  expect(store.getState().threadSearchInfo.status).toBe('initial')
  expect(store.getState().messageCenterOrdinal?.highlightMode).toBe('none')
})
