// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as Shared from './shared'
import HiddenString from '../../util/hidden-string'
import {TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {all, call, put, select} from 'redux-saga/effects'
import {isMobile} from '../../constants/platform'
import {usernameSelector} from '../../constants/selectors'
import {navigateTo} from '../../actions/route-tree'
import {chatTab} from '../../constants/tabs'

import type {TypedState} from '../../constants/reducer'
import type {SagaGenerator} from '../../constants/types/saga'

function* deleteMessage(action: Constants.DeleteMessage): SagaGenerator<any, any> {
  const {message} = action.payload
  let messageID
  let conversationIDKey: ?Constants.ConversationIDKey
  switch (message.type) {
    case 'Text':
    case 'Attachment':
      const attrs = Constants.splitMessageIDKey(message.key)
      messageID = Constants.parseMessageID(attrs.messageID).msgID
      conversationIDKey = attrs.conversationIDKey
      break
  }

  if (!conversationIDKey) throw new Error('No conversation for message delete')

  if (messageID) {
    // Deleting a server message.
    const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield all([
      select(Shared.selectedInboxSelector, conversationIDKey),
      select(Constants.lastMessageID, conversationIDKey),
    ])
    yield put(navigateTo([], [chatTab, conversationIDKey]))

    const outboxID = yield call(ChatTypes.localGenerateOutboxIDRpcPromise)
    yield call(ChatTypes.localPostDeleteNonblockRpcPromise, {
      param: {
        clientPrev: lastMessageID ? Constants.parseMessageID(lastMessageID).msgID : 0,
        conversationID: Constants.keyToConversationID(conversationIDKey),
        identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
        outboxID,
        supersedes: messageID,
        tlfName: inboxConvo.name,
        tlfPublic: false,
      },
    })
  } else {
    // Deleting a local outbox message.
    const outboxID = message.outboxID
    if (!outboxID) throw new Error('No outboxID for pending message delete')

    yield call(ChatTypes.localCancelPostRpcPromise, {
      param: {outboxID: Constants.keyToOutboxID(outboxID)},
    })
    // It's deleted, but we don't get notified that the conversation now has
    // one less outbox entry in it.  Gotta remove it from the store ourselves.
    yield put(Creators.removeOutboxMessage(conversationIDKey, outboxID))
  }
}

function* postMessage(action: Constants.PostMessage): SagaGenerator<any, any> {
  let {conversationIDKey} = action.payload

  const inSearch = yield select((state: TypedState) => state.chat.get('inSearch'))
  if (inSearch) {
    yield put(Creators.exitSearch())
  }

  if (Constants.isPendingConversationIDKey(conversationIDKey)) {
    // Get a real conversationIDKey
    conversationIDKey = yield call(Shared.startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield all([
    select(Shared.selectedInboxSelector, conversationIDKey),
    select(Constants.lastMessageID, conversationIDKey),
  ])

  const outboxID = yield call(ChatTypes.localGenerateOutboxIDRpcPromise)
  const author = yield select(usernameSelector)
  const outboxIDKey = Constants.outboxIDToKey(outboxID)

  const message: Constants.Message = {
    author,
    conversationIDKey: conversationIDKey,
    deviceName: '',
    deviceType: isMobile ? 'mobile' : 'desktop',
    editedCount: 0,
    failureDescription: '',
    key: Constants.messageKey(conversationIDKey, 'outboxIDText', outboxIDKey),
    message: new HiddenString(action.payload.text.stringValue()),
    messageState: 'pending',
    outboxID: outboxIDKey,
    senderDeviceRevokedAt: null,
    timestamp: Date.now(),
    type: 'Text',
    you: author,
  }

  const selectedConversation = yield select(Constants.getSelectedConversation)
  const appFocused = yield select(Shared.focusedSelector)

  yield put(
    Creators.appendMessages(
      conversationIDKey,
      conversationIDKey === selectedConversation,
      appFocused,
      [message],
      false
    )
  )

  yield call(ChatTypes.localPostTextNonblockRpcPromise, {
    param: {
      conversationID: Constants.keyToConversationID(conversationIDKey),
      tlfName: inboxConvo.name,
      tlfPublic: false,
      outboxID,
      body: action.payload.text.stringValue(),
      identifyBehavior: yield call(Shared.getPostingIdentifyBehavior, conversationIDKey),
      clientPrev: lastMessageID ? Constants.parseMessageID(lastMessageID).msgID : 0,
    },
  })
}

function* editMessage(action: Constants.EditMessage): SagaGenerator<any, any> {
  const {message} = action.payload
  let messageID
  let conversationIDKey: Constants.ConversationIDKey = ''
  switch (message.type) {
    case 'Text':
    case 'Attachment': // fallthrough
      const attrs = Constants.splitMessageIDKey(message.key)
      messageID = Constants.parseMessageID(attrs.messageID).msgID
      conversationIDKey = attrs.conversationIDKey
      break
  }

  if (!messageID) {
    console.warn('Editing unknown message type', message)
    return
  }

  const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield all([
    select(Shared.selectedInboxSelector, conversationIDKey),
    select(Constants.lastMessageID, conversationIDKey),
  ])

  // Not editing anymore
  yield put(Creators.showEditor(null))

  const outboxID = yield call(ChatTypes.localGenerateOutboxIDRpcPromise)
  yield call(ChatTypes.localPostEditNonblockRpcPromise, {
    param: {
      body: action.payload.text.stringValue(),
      clientPrev: lastMessageID ? Constants.parseMessageID(lastMessageID).msgID : 0,
      conversationID: Constants.keyToConversationID(conversationIDKey),
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      outboxID,
      supersedes: messageID,
      tlfName: inboxConvo.name,
      tlfPublic: false,
    },
  })
}

function* retryMessage(action: Constants.RetryMessage): SagaGenerator<any, any> {
  const {conversationIDKey, outboxIDKey} = action.payload
  yield put(Creators.updateTempMessage(conversationIDKey, {messageState: 'pending'}, outboxIDKey))
  yield call(ChatTypes.localRetryPostRpcPromise, {
    param: {outboxID: Constants.keyToOutboxID(outboxIDKey)},
  })
}

export {deleteMessage, editMessage, postMessage, retryMessage}
