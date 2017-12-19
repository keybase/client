// @flow
import * as I from 'immutable'
import * as Chat2Gen from './chat2-gen'
import * as Constants from '../constants/chat2'
import * as RPCChatTypes from '../constants/types/flow-types-chat'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import type {TypedState} from '../constants/reducer'

/*
 * TODO:
 * refresh the inbox.
 * convert items to threads
 * represent untrusted thread items
 *
 * .>>>> loading state
 * >>>> Send tlfname and convid to send so daemon can verify its been unboxed
 */

const inboxQuery = {
  computeActiveList: true,
  readOnly: false,
  status: Object.keys(RPCChatTypes.commonConversationStatus)
    .filter(k => !['ignored', 'blocked', 'reported'].includes(k))
    .map(k => RPCChatTypes.commonConversationStatus[k]),
  tlfVisibility: RPCTypes.commonTLFVisibility.private,
  topicType: RPCChatTypes.commonTopicType.chat,
  unreadOnly: false,
}

function* rpcInboxRefresh(action: Chat2Gen.InboxRefreshPayload): Generator<any, void, any> {
  const loadInboxChanMap = RPCChatTypes.localGetInboxNonblockLocalRpcChannelMap(
    ['chat.1.chatUi.chatInboxUnverified', 'finished'],
    {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      maxUnbox: 0,
      query: inboxQuery,
      skipUnverified: false,
    }
  )

  const incoming = yield loadInboxChanMap.race()

  if (incoming.finished) {
    if (incoming.finished.error) {
      throw new Error(`Can't load inbox ${incoming.finished.error}`)
    }
  } else if (incoming['chat.1.chatUi.chatInboxUnverified']) {
    incoming['chat.1.chatUi.chatInboxUnverified'].response.result()
    const result: RPCChatTypes.UnverifiedInboxUIItems = JSON.parse(
      incoming['chat.1.chatUi.chatInboxUnverified'].params.inbox
    )
    const untrusted = (result.items || []).map(Constants.unverifiedInboxUIItemToConversation)
    yield Saga.put(Chat2Gen.createInboxUtrustedLoaded({untrusted}))
  }
}

// We keep a set of conversations to unbox
let unboxQueue = I.OrderedSet()
function addConversationsToUnboxQueue(action: Chat2Gen.QueueUnboxConversationsPayload) {
  unboxQueue = unboxQueue.concat(action.payload.conversationIDKeys)
  return Saga.put(Chat2Gen.createUnboxSomeConversations())
}

// Watch the unboxing queue and take up to 10 items. Choose the last items first since they're likely still visible
function unboxSomeConversations(action: Chat2Gen.QueueUnboxConversationsPayload, state: TypedState) {
  const maxToUnboxAtATime = 10
  const maybeUnbox = unboxQueue.takeLast(maxToUnboxAtATime)
  unboxQueue = unboxQueue.skipLast(maxToUnboxAtATime)

  const conversationIDKeys = maybeUnbox.filter(
    id => state.chat2.metaMap.getIn([id, 'loadingState'], 'untrusted') === 'untrusted'
  )
  const toUnboxActions = conversationIDKeys.size
    ? [Saga.put(Chat2Gen.createUnboxConversations({conversationIDKeys: conversationIDKeys.toArray()}))]
    : []
  const unboxSomeMoreActions = unboxQueue.size ? [Saga.put(Chat2Gen.createUnboxSomeConversations())] : []
  const delayBeforeUnboxingMoreActions = toUnboxActions.length && unboxSomeMoreActions.length
    ? [Saga.call(Saga.delay, 100)]
    : []

  const nextActions = [...toUnboxActions, ...delayBeforeUnboxingMoreActions, ...unboxSomeMoreActions]

  if (nextActions.length) {
    return Saga.sequentially(nextActions)
  }
}

function rpcUnboxConversations(action: Chat2Gen.UnboxConversationsPayload) {
  // const loadInboxRpc = new EngineRpc.EngineRpcCall(
  // unboxConversationsSagaMap,
  // RPCChatTypes.localGetInboxNonblockLocalRpcChannelMap,
  // 'unboxConversations',
  // {
  // identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
  // skipUnverified: forInboxSync,
  // query: {
  // ..._getInboxQuery,
  // convIDs: conversationIDKeys.map(Constants.keyToConversationID),
  // },
  // }
  // )
  // try {
  // yield Saga.call(loadInboxRpc.run, 30e3)
  // } catch (error) {
  // if (error instanceof RPCTimeoutError) {
  // logger.warn('unboxConversations: timed out request for unboxConversations, bailing')
  // yield Saga.put.resolve(
  // ChatGen.createReplaceEntity({
  // keyPath: ['inboxUntrustedState'],
  // entities: I.Map(conversationIDKeys.map(c => [c, 'untrusted'])),
  // })
  // )
  // } else {
  // logger.warn('unboxConversations: error in loadInboxRpc')
  // logger.debug('unboxConversations: error in loadInboxRpc', error)
  // }
  // }
  // if (dismissSyncing) {
  // yield Saga.put(ChatGen.createSetInboxSyncingState({inboxSyncingState: 'notSyncing'}))
  // }
}

function updateConversationState(action: Chat2Gen.UnboxConversationsPayload) {
  let newState
  switch (action.type) {
    case Chat2Gen.unboxConversations:
      newState = 'unboxing'
      break
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // errors if we don't handle any new actions
  }
  return Saga.put(
    Chat2Gen.createUpdateConverationLoadingStates({
      conversationIDKeys: action.payload.conversationIDKeys,
      newState,
    })
  )
}

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(Chat2Gen.inboxRefresh, rpcInboxRefresh)
  yield Saga.safeTakeEveryPure(Chat2Gen.queueUnboxConversations, addConversationsToUnboxQueue)
  yield Saga.safeTakeEveryPure(Chat2Gen.unboxSomeConversations, unboxSomeConversations)
  yield Saga.safeTakeEveryPure([Chat2Gen.unboxConversations], updateConversationState)
  yield Saga.safeTakeEveryPure(Chat2Gen.unboxConversations, rpcUnboxConversations)
}

export default chat2Saga
