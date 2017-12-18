// @flow
import * as Chat2Gen from './chat2-gen'
import * as Constants from '../constants/chat2'
import * as RPCChatTypes from '../constants/types/flow-types-chat'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
// import type {TypedState} from '../constants/reducer'

/*
 * TODO:
 * refresh the inbox.
 * convert items to threads
 * represent untrusted thread items
 *
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
    // yield Saga.put(Chat2Gen.createSetInboxGlobalUntrustedState({inboxGlobalUntrustedState: 'loaded'}))
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

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(Chat2Gen.inboxRefresh, rpcInboxRefresh)
}

export default chat2Saga
