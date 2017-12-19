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

  const conversationIDKeys = maybeUnbox.filter(id => !state.chat2.metaMap.getIn([id, 'isUnboxed'], false))
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
  console.log('aaa', action.payload)
}

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(Chat2Gen.inboxRefresh, rpcInboxRefresh)
  yield Saga.safeTakeEveryPure(Chat2Gen.queueUnboxConversations, addConversationsToUnboxQueue)
  yield Saga.safeTakeEveryPure(Chat2Gen.unboxSomeConversations, unboxSomeConversations)
  yield Saga.safeTakeEveryPure(Chat2Gen.unboxConversations, rpcUnboxConversations)
}

export default chat2Saga
