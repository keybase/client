import * as Meta from '../constants/chat/meta'
import * as Message from '../constants/chat/message'
import * as T from '../constants/types'
import HiddenString from '../util/hidden-string'
import {
  compareConvoStoreStatesForTesting,
  createConvoStoreForTesting,
  type ConvoState,
} from './convostate'
import {createConvoStoreForTesting as createBaseConvoStoreForTesting} from './convostate.base'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const ordinal = T.Chat.numberToOrdinal(10)
const msgID = T.Chat.numberToMessageID(101)
const outboxID = T.Chat.stringToOutboxID('outbox-1')

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

const createPair = () => {
  const baseline = createBaseConvoStoreForTesting(convID)
  const indexed = createConvoStoreForTesting(convID)
  return {baseline, indexed}
}

const seedPairWithAnchoredMessage = () => {
  const {baseline, indexed} = createPair()
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
  applyState(baseline, baseState)
  applyState(indexed, {
    ...baseState,
    messageIDToOrdinal: new Map([[msgID, ordinal]]),
  })
  return {baseline, indexed}
}

const assertEquivalent = (left: Record<string, unknown>, right: Record<string, unknown>) => {
  expect(compareConvoStoreStatesForTesting(left, right)).toBe(true)
}

test('reaction updates preserve outbox-anchored row identity', () => {
  const {baseline, indexed} = seedPairWithAnchoredMessage()
  const reactions = new Map([[':+1:', makeReaction('bob', 5)]])
  baseline.getState().dispatch.updateReactions([{reactions, targetMsgID: msgID}])
  indexed.getState().dispatch.updateReactions([{reactions, targetMsgID: msgID}])
  assertEquivalent(baseline.getState(), indexed.getState())
  expect(baseline.getState().reactionOrderMap.get(ordinal)?.[0]).toBe(':+1:')
  expect(indexed.getState().reactionOrderMap.get(ordinal)?.[0]).toBe(':+1:')
  expect(baseline.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
  expect(indexed.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
})

test('message deletion matches baseline row removal behavior', () => {
  const {baseline, indexed} = seedPairWithAnchoredMessage()
  baseline.getState().dispatch.messagesWereDeleted({messageIDs: [msgID]})
  indexed.getState().dispatch.messagesWereDeleted({messageIDs: [msgID]})
  assertEquivalent(baseline.getState(), indexed.getState())
  expect(baseline.getState().messageMap.has(ordinal)).toBe(false)
  expect(indexed.getState().messageMap.has(ordinal)).toBe(false)
  expect(baseline.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
  expect(indexed.getState().pendingOutboxToOrdinal.get(outboxID)).toBe(ordinal)
  expect(indexed.getState().messageIDToOrdinal.has(msgID)).toBe(false)
})

test('explode-now updates remain equivalent across implementations', () => {
  const {baseline, indexed} = seedPairWithAnchoredMessage()
  baseline.getState().dispatch.messagesExploded([msgID], 'bob')
  indexed.getState().dispatch.messagesExploded([msgID], 'bob')
  assertEquivalent(baseline.getState(), indexed.getState())
  const left = baseline.getState().messageMap.get(ordinal)
  const right = indexed.getState().messageMap.get(ordinal)
  expect(left?.type).toBe('text')
  expect(right?.type).toBe('text')
  expect(left?.type === 'text' ? left.text.stringValue() : undefined).toBe('')
  expect(right?.type === 'text' ? right.text.stringValue() : undefined).toBe('')
})

test('messagesClear resets all message indexes and maps', () => {
  const {baseline, indexed} = seedPairWithAnchoredMessage()
  baseline.getState().dispatch.messagesClear()
  indexed.getState().dispatch.messagesClear()
  assertEquivalent(baseline.getState(), indexed.getState())
  expect(baseline.getState().messageMap.size).toBe(0)
  expect(indexed.getState().messageMap.size).toBe(0)
  expect(baseline.getState().pendingOutboxToOrdinal.size).toBe(0)
  expect(indexed.getState().pendingOutboxToOrdinal.size).toBe(0)
  expect(indexed.getState().messageIDToOrdinal.size).toBe(0)
})
