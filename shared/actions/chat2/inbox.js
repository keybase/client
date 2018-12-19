// @flow
import * as Chat2Gen from '../chat2-gen'
// import * as I from 'immutable'
import * as Saga from '../../util/saga'
import type {TypedState} from '../../util/container'

const clearFilter = (
  action: Chat2Gen.SelectConversationPayload | Chat2Gen.MessageSendPayload,
  state: TypedState
) => {
  if (!state.chatInbox.filter) {
    return
  }

  if (
    action.type === Chat2Gen.selectConversation &&
    (action.payload.reason === 'inboxFilterArrow' || action.payload.reason === 'inboxFilterChanged')
  ) {
    return
  }

  return Saga.put(Chat2Gen.createSetInboxFilter({filter: ''}))
}

function* inboxSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure([Chat2Gen.selectConversation, Chat2Gen.messageSend], clearFilter)
}

export default inboxSaga
