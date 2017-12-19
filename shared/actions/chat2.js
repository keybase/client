// @flow
import * as Chat2Gen from './chat2-gen'
import * as Constants from '../constants/chat2'
import * as EngineRpc from '../constants/engine'
import * as I from 'immutable'
import * as RPCChatTypes from '../constants/types/flow-types-chat'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import * as Types from '../constants/types/chat2'
import logger from '../logger'
import type {TypedState} from '../constants/reducer'
import {RPCTimeoutError} from '../util/errors'

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

// Only get the untrusted conversations out
const untrustedConversationIDKeys = (state: TypedState, ids: Array<Types.ConversationIDKey>) =>
  ids.filter(id => state.chat2.metaMap.getIn([id, 'loadingState'], 'untrusted') === 'untrusted')

// We keep a set of conversations to unbox
let unboxQueue = I.OrderedSet()
function addConversationsToUnboxQueue(action: Chat2Gen.QueueUnboxConversationsPayload, state: TypedState) {
  const old = unboxQueue
  unboxQueue = unboxQueue.concat(untrustedConversationIDKeys(state, action.payload.conversationIDKeys))
  if (old !== unboxQueue) {
    // only unboxMore if something changed
    return Saga.put(Chat2Gen.createUnboxSomeConversations())
  }
}

// Watch the unboxing queue and take up to 10 items. Choose the last items first since they're likely still visible
function unboxSomeConversations(action: Chat2Gen.QueueUnboxConversationsPayload, state: TypedState) {
  const maxToUnboxAtATime = 10
  const maybeUnbox = unboxQueue.takeLast(maxToUnboxAtATime)
  unboxQueue = unboxQueue.skipLast(maxToUnboxAtATime)

  const conversationIDKeys = untrustedConversationIDKeys(state, maybeUnbox.toArray())
  const toUnboxActions = conversationIDKeys.length
    ? [Saga.put(Chat2Gen.createUnboxConversations({conversationIDKeys}))]
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
  const loadInboxRpc = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatInboxConversation': function*({
        conv,
      }: RPCChatTypes.ChatUiChatInboxConversationRpcParam) {
        yield Saga.put(Chat2Gen.createUnboxingSuccess({inboxItem: JSON.parse(conv)}))
        return EngineRpc.rpcResult()
      },
      'chat.1.chatUi.chatInboxFailed': function*({
        convID,
        error,
      }: RPCChatTypes.ChatUiChatInboxFailedRpcParam) {
        yield Saga.put(
          Chat2Gen.createUnboxingFailure({conversationIDKey: Constants.conversationIDToKey(convID), error})
        )
        return EngineRpc.rpcResult()
      },
      'chat.1.chatUi.chatInboxUnverified': EngineRpc.passthroughResponseSaga,
    },
    RPCChatTypes.localGetInboxNonblockLocalRpcChannelMap,
    'unboxConversations',
    {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      query: {
        ...inboxQuery,
        convIDs: action.payload.conversationIDKeys.map(Constants.keyToConversationID),
      },
      skipUnverified: false,
    }
  )

  return Saga.call(loadInboxRpc.run, 30e3)
  // if (dismissSyncing) {
  // yield Saga.put(ChatGen.createSetInboxSyncingState({inboxSyncingState: 'notSyncing'}))
  // }
}

function rpcUnboxConversationsError(error: Error, action: Chat2Gen.UnboxConversationsPayload) {
  if (error instanceof RPCTimeoutError) {
    logger.warn('unboxConversations: timed out request for unboxConversations, bailing')
    // yield Saga.put.resolve(
    // ChatGen.createReplaceEntity({
    // keyPath: ['inboxUntrustedState'],
    // entities: I.Map(conversationIDKeys.map(c => [c, 'untrusted'])),
    // })
    // )
  } else {
    logger.warn('unboxConversations: error in loadInboxRpc')
    logger.debug('unboxConversations: error in loadInboxRpc', error)
  }
}

function updateConversationState(action: Chat2Gen.UnboxConversationsPayload) {
  let newState
  let conversationIDKeys
  switch (action.type) {
    case Chat2Gen.unboxConversations:
      newState = 'unboxing'
      conversationIDKeys = action.payload.conversationIDKeys
      break
    case Chat2Gen.unboxingSuccess:
      newState = 'unboxed'
      conversationIDKeys = [action.payload.inboxItem.convID]
      break
    case Chat2Gen.unboxingFailure:
      newState = 'unboxed'
      conversationIDKeys = [action.payload.conversationIDKey]
      break
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // errors if we don't handle any new actions
      throw new Error('Invalid action passed to updateConversationState')
  }
  return Saga.put(
    Chat2Gen.createUpdateConverationLoadingStates({
      conversationIDKeys,
      newState,
    })
  )
}

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  // Refresh the inbox
  yield Saga.safeTakeLatest(Chat2Gen.inboxRefresh, rpcInboxRefresh)
  // We've scrolled some new inbox rows into view, queue them up
  yield Saga.safeTakeEveryPure(Chat2Gen.queueUnboxConversations, addConversationsToUnboxQueue)
  // We have some items in the queue to process
  yield Saga.safeTakeEveryPure(Chat2Gen.unboxSomeConversations, unboxSomeConversations)
  // Mark rows as loading, unboxing, unboxed, etc
  yield Saga.safeTakeEveryPure(
    [Chat2Gen.unboxConversations, Chat2Gen.unboxingSuccess, Chat2Gen.unboxingFailure],
    updateConversationState
  )
  // Actually try and unbox conversations
  yield Saga.safeTakeEveryPure(
    Chat2Gen.unboxConversations,
    rpcUnboxConversations,
    () => {},
    rpcUnboxConversationsError
  )
}

export default chat2Saga
