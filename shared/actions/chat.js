// @flow
import * as Constants from '../constants/chat'
import HiddenString from '../util/hidden-string'
import engine from '../engine'
import {CommonMessageType, CommonTLFVisibility, LocalMessageUnboxedState, NotifyChatChatActivityType, localGetInboxAndUnboxLocalRpcPromise, localGetThreadLocalRpcPromise, localPostLocalNonblockRpcPromise} from '../constants/types/flow-types-chat'
import {List, Map} from 'immutable'
import {badgeApp} from '../actions/notifications'
import {call, put, select} from 'redux-saga/effects'
import {safeTakeEvery, safeTakeLatest} from '../util/saga'
import {throttle} from 'redux-saga'
import {usernameSelector} from '../constants/selectors'

import type {ConversationIDKey, InboxState, IncomingMessage, LoadInbox, LoadMoreMessages, LoadedInbox, Message, PostMessage, SelectConversation, SetupNewChatHandler} from '../constants/chat'
import type {GetInboxAndUnboxLocalRes, IncomingMessage as IncomingMessageRPCType, MessageUnboxed} from '../constants/types/flow-types-chat'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

const {conversationIDToKey, keyToConversationID, InboxStateRecord, makeSnippet} = Constants

function postMessage (conversationIDKey: ConversationIDKey, text: HiddenString): PostMessage {
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
    if (!convo.info.id) {
      return null
    }

    let snippet
    (convo.maxMessages || []).some(message => {
      if (message.state === LocalMessageUnboxedState.valid && message.valid) {
        switch (message.valid.messageBody.messageType) {
          case CommonMessageType.text:
            snippet = makeSnippet(message.valid.messageBody.text && message.valid.messageBody.text.body, 100)
            return true
          case CommonMessageType.attachment:
            snippet = 'Attachment'
            return true
          default:
            return false
        }
      }
      return false
    })

    return new InboxStateRecord({
      info: convo.info,
      conversationIDKey: conversationIDToKey(convo.info.id),
      participants: List(convo.info.writerNames || []), // TODO in recent order... somehow
      muted: false, // TODO
      time: convo.readerInfo.mtime,
      snippet,
      unreadCount: convo.readerInfo.maxMsgid - convo.readerInfo.readMsgid, // TODO likely get this from the notifications payload miles is working on
    })
  }).filter(Boolean))
}

function * _postMessage (action: PostMessage): SagaGenerator<any, any> {
  const infoSelector = (state: TypedState) => {
    const convo = state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === action.payload.conversationIDKey)
    if (convo) {
      return convo.get('info')
    }
    return null
  }

  const info = yield select(infoSelector)

  if (!info) {
    console.warn('No info to postmessage!')
    return
  }

  const configSelector = (state: TypedState) => {
    try {
      return {
        // $FlowIssue doesn't understand try
        deviceID: state.config.extendedConfig.device.deviceID,
        uid: state.config.uid,
      }
    } catch (_) {
      return {
        deviceID: '',
        uid: '',
      }
    }
  }

  const {deviceID, uid}: {deviceID: string, uid: string} = ((yield select(configSelector)): any)

  if (!deviceID || !uid) {
    console.warn('No deviceid/uid to postmessage!')
    return
  }

  const clientHeader = {
    conv: info.triple,
    tlfName: info.tlfName,
    tlfPublic: info.visibility === CommonTLFVisibility.public,
    messageType: CommonMessageType.text,
    supersedes: 0,
    sender: Buffer.from(uid, 'hex'),
    senderDevice: Buffer.from(deviceID, 'hex'),
  }

  const sent = yield call(localPostLocalNonblockRpcPromise, {
    param: {
      conversationID: keyToConversationID(action.payload.conversationIDKey),
      msg: {
        clientHeader,
        messageBody: {
          messageType: CommonMessageType.text,
          text: {
            body: action.payload.text.stringValue(),
          },
        },
      },
    },
  })

  const author = yield select(usernameSelector)
  if (sent && author) {
    const message: Message = {
      type: 'Text',
      author,
      outboxID: sent.outboxID.toString('hex'),
      timestamp: Date.now(),
      messageState: 'pending',
      message: new HiddenString(action.payload.text.stringValue()),
      followState: 'You',
    }
    yield put({
      type: Constants.appendMessages,
      payload: {
        conversationIDKey: action.payload.conversationIDKey,
        messages: [message],
      },
    })
  }
}

function * _incomingMessage (action: IncomingMessage): SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case NotifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?IncomingMessageRPCType = action.payload.activity.incomingMessage
      if (incomingMessage) {
        const messageUnboxed: MessageUnboxed = incomingMessage.message
        const yourName = yield select(usernameSelector)
        const message = _unboxedToMessage(messageUnboxed, 0, yourName)
        const conversationIDKey = conversationIDToKey(incomingMessage.convID)

        // TODO short-term if we haven't seen this in the conversation list we'll refresh the inbox. Instead do an integration w/ gregor
        const conversationStateSelector = (state: TypedState) => state.chat.get('conversationStates', Map()).get(conversationIDKey)
        const conversationState = yield select(conversationStateSelector)
        if (!conversationState) {
          yield put(loadInbox())
        }

        if (message.outboxID && message.type === 'Text' && yourName === message.author) {
          // If the message has an outboxID, then we sent it and have already
          // rendered it in the message list; we just need to mark it as sent.
          yield put({
            type: Constants.pendingMessageWasSent,
            payload: {
              conversationIDKey,
              outboxID: message.outboxID,
              messageID: message.messageID,
              messageState: 'sent',
            },
          })
        } else {
          yield put({
            type: Constants.appendMessages,
            payload: {
              conversationIDKey,
              messages: [message],
            },
          })
        }
      }
      break
    default:
      console.warn('Unsupported incoming message type for Chat')
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

  const yourName = yield select(usernameSelector)
  const messages = (thread && thread.thread && thread.thread.messages || []).map((message, idx) => _unboxedToMessage(message, idx, yourName)).reverse()
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

// Update the badging of the app. This is a short term impl so we can get this info. It'll come from the daemon later
function * _updateBadge (): SagaGenerator<any, any> {
  const inboxSelector = (state: TypedState) => state.chat.get('inbox')
  const inbox: List<InboxState> = ((yield select(inboxSelector)): any)

  const total = inbox.reduce((total, i) => total + i.get('unreadCount'), 0)
  yield put(badgeApp('chatInbox', total > 0, total))
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

function _unboxedToMessage (message: MessageUnboxed, idx: number, yourName): Message {
  if (message.state === LocalMessageUnboxedState.valid) {
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
          return {
            type: 'Text',
            ...common,
            message: new HiddenString(payload.messageBody && payload.messageBody.text && payload.messageBody.text.body || ''),
            followState: isYou ? 'You' : 'Following', // TODO get this
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
            outboxID: payload.clientHeader.outboxID && payload.clientHeader.outboxID.toString('hex'),
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
    timestamp: Date.now(),
    reason: 'temp',
  }
}

function * _selectConversation (action: SelectConversation): SagaGenerator<any, any> {
  yield put(loadMoreMessages())
  yield put({type: Constants.updateBadge, payload: undefined})
}

function * chatSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeLatest(Constants.loadInbox, _loadInbox),
    safeTakeLatest(Constants.loadedInbox, _loadedInbox),
    safeTakeEvery(Constants.loadMoreMessages, _loadMoreMessages),
    safeTakeLatest(Constants.selectConversation, _selectConversation),
    safeTakeEvery(Constants.setupNewChatHandler, _setupNewChatHandler),
    safeTakeEvery(Constants.incomingMessage, _incomingMessage),
    safeTakeEvery(Constants.postMessage, _postMessage),
    yield throttle(1000, Constants.updateBadge, _updateBadge),
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
