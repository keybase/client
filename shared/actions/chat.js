// @flow
import * as Constants from '../constants/chat'
import _ from 'lodash'
import {List, Map} from 'immutable'
import {call, put, select} from 'redux-saga/effects'
import {localGetInboxLocalRpcPromise, CommonMessageType, localGetThreadLocalRpcPromise} from '../constants/types/flow-types-chat'
import {takeLatest} from 'redux-saga'

import type {LoadMoreMessages, ConversationIDKey, SelectConversation, LoadInbox, Message, InboxState, LoadedInbox} from '../constants/chat'
import type {MessageUnboxed, GetInboxLocalRes} from '../constants/types/flow-types-chat'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

const {conversationIDToKey, keyToConversationID, InboxStateRecord} = Constants

function loadInbox (): LoadInbox {
  return {type: Constants.loadInbox, payload: undefined}
}

function loadMoreMessages (): LoadMoreMessages {
  return {type: Constants.loadMoreMessages, payload: undefined}
}

function selectConversation (conversationIDKey: ConversationIDKey): SelectConversation {
  return {type: Constants.selectConversation, payload: {conversationIDKey}}
}

function _inboxToConversations (inbox: GetInboxLocalRes): List<InboxState> {
  return List((inbox.conversationsUnverified || []).map(convo => {
    return new InboxStateRecord({
      conversationIDKey: conversationIDToKey(convo.metadata.conversationID),
      participants:
        convo.maxMsgs &&
        convo.maxMsgs.length &&
        convo.maxMsgs[0].clientHeader &&
        convo.maxMsgs[0].clientHeader.tlfName &&
        List(convo.maxMsgs[0].clientHeader.tlfName.split(',')) || List(), // TODO in recent order... somehow
      muted: false,
      time: 'TODO',
      snippet: 'TODO',
    })
  }))
}

function * _loadInbox (): SagaGenerator<any, any> {
  // $ForceType
  const inbox: GetInboxLocalRes = yield call(localGetInboxLocalRpcPromise, {params: {}})
  console.log('aaaa got inbox', inbox)

  const conversations: List<InboxState> = _inboxToConversations(inbox)
  yield put({type: Constants.loadedInbox, payload: {inbox: conversations}})
}

function * _loadedInbox (action: LoadedInbox): SagaGenerator<any, any> {
  const selector = (state: TypedState) => state.chat.get('selectedConversation')
  const selectedConversation = yield select(selector)

  if (!selectedConversation) {
    if (action.payload.inbox.count()) {
      const mostRecentConversation = action.payload.inbox.get(0)
      yield put(selectConversation(mostRecentConversation.get('conversationIDKey')))
    }
  }
}

function * _loadMoreMessages (): SagaGenerator<any, any> {
  const selectedSelector = (state: TypedState) => state.chat.get('selectedConversation')
  const conversationIDKey = yield select(selectedSelector)

  if (!conversationIDKey) {
    return
  }

  const query = {
    markAsRead: true,
  }

  // const pagination = {
    // next: bytes,
    // previous: bytes,
    // num: int,
    // last: boolean,
  // }

  // next = oldPagination.next

  const conversationID = keyToConversationID(conversationIDKey)

  const paginationNextSelector = (state: TypedState) => state.chat.get('conversationStates', Map()).get(conversationIDKey, Map()).get('paginationNext', undefined)
  const next = yield select(paginationNextSelector)
  const pagination = {
    next,
    num: Constants.maxMessagesToLoadAtATime,
  }

  const thread = yield call(localGetThreadLocalRpcPromise, {param: {conversationID, query, pagination}})
  console.log('aaaa got thread', thread)

  const yourNameSelector = (state: TypedState) => state.config.username
  const yourName = yield select(yourNameSelector)

  const messages = (thread && thread.thread && thread.thread.messages || []).map((message, idx) => _threadToStorable(message, idx, yourName)).reverse()
  console.log('aaaa got messages', messages)
  const moreToLoad = thread && thread.thread && thread.thread.pagination && !thread.thread.pagination.last
  const paginationNext = thread && thread.thread && thread.thread.pagination && thread.thread.pagination.next
  // const paginationPrevious = thread && thread.thread && thread.thread.pagination && thread.thread.pagination.previous
  yield put({type: Constants.prependMessages, payload: {conversationIDKey, messages, moreToLoad, paginationNext/*, paginationPrevious*/}})
}

function _threadToStorable (message: MessageUnboxed, idx: number, yourName): Message {
  if (message.state === 1) {
    const payload = message.valid
    if (payload) {
      const common = {
        author: payload.senderUsername,
        timestamp: payload.serverHeader.ctime,
        messageID: payload.serverHeader.messageID,
      }

      const isYou = common.author === yourName

      switch (payload.messageBody.messageType) {
        case CommonMessageType.text:
          // $FlowIssue dunno
          return {
            ...common,
            type: 'Text',
            message: payload.messageBody && payload.messageBody.text && payload.messageBody.text.body || '',
            followState: isYou ? 'you' : 'following', // TODO get this
          }
        default:
          return {
            ...common,
            type: 'Unhandled',
          }
      }
    }
  }
  return {
    type: 'Error', // TODO
    messageID: idx,
    reason: 'temp',
  }
}

function * _selectConversation (action: SelectConversation): SagaGenerator<any, any> {
  yield put(loadMoreMessages())
}

function * chatSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.loadInbox, _loadInbox),
    takeLatest(Constants.loadedInbox, _loadedInbox),
    takeLatest(Constants.loadMoreMessages, _loadMoreMessages),
    takeLatest(Constants.selectConversation, _selectConversation),
  ]
}

export default chatSaga

export {
  loadInbox,
  loadMoreMessages,
  selectConversation,
}
