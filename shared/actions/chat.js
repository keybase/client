// @flow
import * as Constants from '../constants/chat'
// import {List} from 'immutable'
import {takeEvery, takeLatest} from 'redux-saga'
import {call, put, select, fork, take} from 'redux-saga/effects'
import {localGetInboxLocalRpcPromise} from '../constants/types/flow-types-chat'

// import { } from '../constants/types/flow-types'
import type {LoadMoreMessages, ConversationID, SelectConversation, LoadInbox } from '../constants/chat'
import type {SagaGenerator} from '../constants/types/saga'

function loadInbox (): LoadInbox {
  return {type: Constants.loadInbox, payload: undefined}
}

function loadMoreMessages (): LoadMoreMessages {
  return {type: Constants.loadMoreMessages, payload: undefined}
}

function selectConversation (conversationID: ConversationID): SelectConversation {
  return {type: Constants.selectConversation, payload: {conversationID}}
}


function * _loadInbox (): SagaGenerator<any, any> {
  // conversationsUnverified?: ?Array<Conversation>,
  // pagination?: ?Pagination,
  // rateLimits?: ?Array<RateLimit>,
  const inbox = yield call(localGetInboxLocalRpcPromise, {params: {}})
  console.log('aaaa got inbox', inbox)
}

function * _loadMoreMessages (): SagaGenerator<any, any> {
  // TODO need chat api conversation id change to string. core is working on it
}

function * _selectConversation (action: SelectConversation): SagaGenerator<any, any> {
  // TEMP just find a conversation w/ coyne and select it
  if (action.payload.conversationID === 'TEMPCHAT') {
    yield put(loadInbox())
    const params = yield take(Constants.loadedInbox)
    console.log('aaaa', params)
  } else {
    yield put(loadMoreMessages())
  }
}

function * chatSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.loadInbox, _loadInbox),
    takeLatest(Constants.loadMoreMessages, _loadMoreMessages),
    takeEvery(Constants.selectConversation, _selectConversation),
  ]
}

export default chatSaga

export {
  loadMoreMessages,
  selectConversation,
}
