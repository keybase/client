import * as Meta from '../constants/chat/meta'
import * as Message from '../constants/chat/message'
import * as T from '../constants/types'
import HiddenString from '../util/hidden-string'
import {useCurrentUserState} from './current-user'
import {createConvoStoreForTesting, type ConvoState} from './convostate'

/*
 * Differential test example for future refactors:
 *
 * import {
 *   compareConvoStoreStatesForTesting,
 *   createConvoStoreForTesting,
 * } from './convostate'
 * import {createConvoStoreForTesting as createBaseConvoStoreForTesting} from './convostate.base'
 *
 * test('base and refactor stay equivalent', () => {
 *   const base = createBaseConvoStoreForTesting(convID)
 *   const next = createConvoStoreForTesting(convID)
 *   // seed both stores, drive the same actions, then compare:
 *   expect(compareConvoStoreStatesForTesting(base.getState(), next.getState())).toBe(true)
 * })
 *
 * `convostate.base.tsx` currently re-exports `./convostate`. When we want real
 * side-by-side validation again, replace that file with a copied baseline
 * implementation that preserves the same testing exports.
 */

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

const makeTextMessage = () =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: msgID,
    ordinal,
    outboxID,
    text: new HiddenString('hello'),
    timestamp: 100,
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
  pendingOutboxID: T.Chat.OutboxID,
  text: string
): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: {
    atMentions: null,
    bodySummary: text,
    botUsername: '',
    channelMention: T.RPCChat.ChannelMention.none,
    channelNameMentions: null,
    ctime: 200,
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
    outboxID: T.Chat.outboxIDToString(pendingOutboxID),
    paymentInfos: null,
    pinnedMessageID: null,
    reactions: {},
    replyTo: null,
    requestInfo: null,
    senderDeviceID: 'device-id',
    senderDeviceName: 'alice-device',
    senderDeviceRevokedAt: null,
    senderDeviceType: 'desktop',
    senderUID: 'uid',
    senderUsername: 'alice',
    superseded: false,
    unfurls: null,
  },
})

const makeMeta = () => ({
  ...Meta.makeConversationMeta(),
  conversationIDKey: convID,
  maxVisibleMsgID: msgID,
  readMsgID: T.Chat.numberToMessageID(0),
})

const applyState = (
  store: {getState: () => any; setState: (state: any) => void},
  partial: Partial<ConvoState> & {messageIDToOrdinal?: Map<T.Chat.MessageID, T.Chat.Ordinal>}
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

test('reaction updates preserve outbox-anchored row identity', () => {
  const store = seedStoreWithAnchoredMessage()
  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])
  store.getState().dispatch.updateReactions([{reactions, targetMsgID: msgID}])
  expect(store.getState().reactionOrderMap.get(ordinal)?.[0]).toBe(':+1:')
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
})

test('message deletion removes the row but preserves the outbox anchor', () => {
  const store = seedStoreWithAnchoredMessage()
  store.getState().dispatch.messagesWereDeleted({messageIDs: [msgID]})
  expect(store.getState().messageMap.has(ordinal)).toBe(false)
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
  expect(store.getState().messageIDToOrdinal.has(msgID)).toBe(false)
})

test('explode-now clears text content in place', () => {
  const store = seedStoreWithAnchoredMessage()
  store.getState().dispatch.messagesExploded([msgID], 'bob')
  const message = store.getState().messageMap.get(ordinal)
  expect(message?.type).toBe('text')
  expect(message?.type === 'text' ? message.text.stringValue() : undefined).toBe('')
})

test('messagesClear resets all message indexes and maps', () => {
  const store = seedStoreWithAnchoredMessage()
  store.getState().dispatch.messagesClear()
  expect(store.getState().messageMap.size).toBe(0)
  expect(store.getState().pendingOutboxToOrdinal.size).toBe(0)
  expect(store.getState().messageIDToOrdinal.size).toBe(0)
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

  const ack = makeValidTextUIMessage(serverMsgID, outboxID, 'acked hello')
  store.getState().dispatch.onMessagesUpdated({updates: [ack]})

  expect(store.getState().messageOrdinals).toEqual([pendingOrdinal])
  expect(store.getState().messageMap.get(pendingOrdinal)?.id).toBe(serverMsgID)
  expect(store.getState().messageIDToOrdinal.get(serverMsgID)).toBe(pendingOrdinal)

  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])
  store.getState().dispatch.updateReactions([{reactions, targetMsgID: serverMsgID}])

  expect(store.getState().reactionOrderMap.get(pendingOrdinal)?.[0]).toBe(':+1:')

  store.getState().dispatch.messagesWereDeleted({messageIDs: [serverMsgID]})

  expect(store.getState().messageMap.has(pendingOrdinal)).toBe(false)
  expect(store.getState().messageIDToOrdinal.has(serverMsgID)).toBe(false)
  expect(store.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(pendingOrdinal)
})
