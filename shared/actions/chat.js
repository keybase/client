// @flow
import * as Constants from '../constants/chat'
import engine from '../engine'
import {List, Map} from 'immutable'
import {call, put, select} from 'redux-saga/effects'
import {localGetInboxAndUnboxLocalRpcPromise, CommonMessageType, localGetThreadLocalRpcPromise, localPostLocalRpcPromise} from '../constants/types/flow-types-chat'
import {takeLatest, takeEvery} from 'redux-saga'

import type {LoadMoreMessages, ConversationIDKey, SelectConversation, LoadInbox, Message, InboxState, LoadedInbox, SetupNewChatHandler, IncomingMessage, PostMessage} from '../constants/chat'
import type {MessageUnboxed, GetInboxAndUnboxLocalRes, IncomingMessage as IncomingMessageRPCType} from '../constants/types/flow-types-chat'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

const {conversationIDToKey, keyToConversationID, InboxStateRecord} = Constants

function postMessage (conversationIDKey: ConversationIDKey, text: string): PostMessage {
  return {type: Constants.postMessage, payload: {conversationIDKey, text}}
}

function setupNewChatHandler (): SetupNewChatHandler {
  return {type: Constants.setupNewChatHandler, payload: undefined}
}

function loadInbox (): LoadInbox {
  return {type: Constants.loadInbox, payload: undefined}
}

function loadMoreMessages (): LoadMoreMessages {
  return {type: Constants.loadMoreMessages, payload: undefined}
}

function selectConversation (conversationIDKey: ConversationIDKey): SelectConversation {
  return {type: Constants.selectConversation, payload: {conversationIDKey}}
}

function _inboxToConversations (inbox: GetInboxAndUnboxLocalRes): List<InboxState> {
  return List((inbox.conversations || []).map(convo => {
    const recentMessage: ?MessageUnboxed = (convo.maxMessages || []).find(message => (
      message.state === 1 && message.valid && message.valid.messageBody.messageType === 1
    ))

    let snippet
    try {
      // $FlowIssue
      snippet = recentMessage.valid.messageBody.text.body
    } catch (_) { }

    return new InboxStateRecord({
      info: convo.info,
      conversationIDKey: conversationIDToKey(convo.info.id),
      participants: List(convo.info.tlfName.split(',')) || List(), // TODO in recent order... somehow
      muted: false,
      time: 'Time',
      snippet,
    })
  }))
}

function * _postMessage (action: PostMessage): SagaGenerator<any, any> {
  const infoSelector = (state: TypedState) => {
    const convo = state.chat.get('inbox').find(convo => (
      convo.get('conversationIDKey') === action.payload.conversationIDKey
    ))
    if (convo) {
      return convo.get('info')
    }
    return null
  }

  const info = yield select(infoSelector)
  debugger
  if (!info) {
    return
  }
  const clientHeader = {
    conv: info.triple,
    tlfName: info.tlfName,
    tlfPublic: false,
    messageType: CommonMessageType.text,
    supersedes: 0,
    sender: 0,
    // gregor1.UID,
    senderDevice: 0,
    // gregor1.DeviceID,
  }

  yield call(localPostLocalRpcPromise, {
    params: {
      conversationID: keyToConversationID(action.payload.conversationIDKey),
      msg: {
        clientHeader,
        messageBody: {
          messageType: CommonMessageType.text,
          text: {
            body: action.payload.text,
          },
        },
      },
    },
  })
}

function * _incomingMessage (action: IncomingMessage): SagaGenerator<any, any> {
  if (action.payload.activity.ActivityType === 1) {
    const incomingMessage: ?IncomingMessageRPCType = action.payload.activity.IncomingMessage
    if (incomingMessage) {
      const messageUnboxed: MessageUnboxed = incomingMessage.message
      const yourNameSelector = (state: TypedState) => state.config.username
      const yourName = yield select(yourNameSelector)
      const message = _threadToStorable(messageUnboxed, 0, yourName)

      yield put({
        type: Constants.appendMessages,
        payload: {
          conversationIDKey: conversationIDToKey(incomingMessage.convID),
          messages: [message],
        },
      })
    }
  }
}

function * _setupNewChatHandler (): SagaGenerator<any, any> {
  yield put((dispatch: Dispatch) => {
    engine().setIncomingHandler('chat.1.NotifyChat.NewChatActivity', ({uid, activity}) => {
      dispatch({type: Constants.incomingMessage, payload: {activity}})
    })
  })
}

function * _loadInbox (): SagaGenerator<any, any> {
  // $ForceType
  const inbox: GetInboxAndUnboxLocalRes = yield call(localGetInboxAndUnboxLocalRpcPromise, {params: {}})
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

  const conversationID = keyToConversationID(conversationIDKey)
  const conversationStateSelector = (state: TypedState) => state.chat.get('conversationStates', Map()).get(conversationIDKey)
  const oldConversationState = yield select(conversationStateSelector)

  let next
  if (oldConversationState) {
    if (oldConversationState.get('isLoading')) {
      __DEV__ && console.log('Bailing on chat load more due to isloading already')
      return
    }

    if (!oldConversationState.get('moreToLoad')) {
      __DEV__ && console.log('Bailing on chat load more due to no more to load')
      return
    }

    next = oldConversationState.get('paginationNext', undefined)
  }

  yield put({type: Constants.loadingMessages, payload: {conversationIDKey}})

  const thread = yield call(localGetThreadLocalRpcPromise, {param: {
    conversationID,
    query: {markAsRead: true},
    pagination: {
      next,
      num: Constants.maxMessagesToLoadAtATime,
    },
  }})

  const yourNameSelector = (state: TypedState) => state.config.username
  const yourName = yield select(yourNameSelector)

  const messages = (thread && thread.thread && thread.thread.messages || []).map((message, idx) => _threadToStorable(message, idx, yourName)).reverse()
  const pagination = _threadToPagination(thread)

  yield put({
    type: Constants.prependMessages,
    payload: {
      conversationIDKey,
      messages,
      moreToLoad: !pagination.last,
      paginationNext: pagination.next,
    },
  })
}

function _threadToPagination (thread) {
  if (thread && thread.thread && thread.thread.pagination) {
    return thread.thread.pagination
  }
  return {
    last: undefined,
    next: undefined,
  }
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
    takeEvery(Constants.loadMoreMessages, _loadMoreMessages),
    takeLatest(Constants.selectConversation, _selectConversation),
    takeEvery(Constants.setupNewChatHandler, _setupNewChatHandler),
    takeEvery(Constants.incomingMessage, _incomingMessage),
    takeEvery(Constants.postMessage, _postMessage),
  ]
}

export default chatSaga

export {
  loadInbox,
  loadMoreMessages,
  selectConversation,
  setupNewChatHandler,
  postMessage,
}
