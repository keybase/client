// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as Shared from './shared'
import HiddenString from '../../util/hidden-string'
import {TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {isMobile} from '../../constants/platform'
import {usernameSelector} from '../../constants/selectors'
import {getPath} from '../../route-tree'
import {navigateTo} from '../../actions/route-tree'
import {chatTab} from '../../constants/tabs'

import type {TypedState} from '../../constants/reducer'
import type {SagaGenerator} from '../../constants/types/saga'

function* deleteMessage(action: Constants.DeleteMessage): SagaGenerator<any, any> {
  const {message} = action.payload
  let messageID: ?Constants.MessageID
  let conversationIDKey: Constants.ConversationIDKey
  switch (message.type) {
    case 'Text':
      conversationIDKey = message.conversationIDKey
      messageID = message.messageID
      break
    case 'Attachment':
      conversationIDKey = message.conversationIDKey
      messageID = message.messageID
      break
  }

  if (!conversationIDKey) throw new Error('No conversation for message delete')

  if (messageID) {
    // Deleting a server message.
    const clientHeader = yield call(
      Shared.clientHeader,
      ChatTypes.CommonMessageType.delete,
      conversationIDKey
    )
    const conversationState = yield select(Shared.conversationStateSelector, conversationIDKey)
    let lastMessageID
    if (conversationState) {
      const message = conversationState.messages.findLast(m => !!m.messageID)
      if (message) {
        lastMessageID = message.messageID
      }
    }

    yield put(navigateTo([], [chatTab, conversationIDKey]))

    yield call(ChatTypes.localPostDeleteNonblockRpcPromise, {
      param: {
        clientPrev: lastMessageID,
        conv: clientHeader.conv,
        conversationID: Constants.keyToConversationID(conversationIDKey),
        identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
        supersedes: messageID,
        tlfName: clientHeader.tlfName,
        tlfPublic: clientHeader.tlfPublic,
      },
    })
  } else {
    // Deleting a local outbox message.
    if (message.messageState !== 'failed') throw new Error('Tried to delete a non-failed message')
    const outboxID = message.outboxID
    if (!outboxID) throw new Error('No outboxID for pending message delete')

    yield call(ChatTypes.localCancelPostRpcPromise, {param: {outboxID: Constants.keyToOutboxID(outboxID)}})
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

  const clientHeader = yield call(Shared.clientHeader, ChatTypes.CommonMessageType.text, conversationIDKey)
  const conversationState = yield select(Shared.conversationStateSelector, conversationIDKey)
  let lastMessageID
  if (conversationState) {
    const message = conversationState.messages.findLast(m => !!m.messageID)
    if (message) {
      lastMessageID = message.messageID
    }
  }

  const sent = yield call(ChatTypes.localPostLocalNonblockRpcPromise, {
    param: {
      conversationID: Constants.keyToConversationID(conversationIDKey),
      identifyBehavior: yield call(Shared.getPostingIdentifyBehavior, conversationIDKey),
      clientPrev: lastMessageID,
      msg: {
        clientHeader,
        messageBody: {
          messageType: ChatTypes.CommonMessageType.text,
          text: {
            body: action.payload.text.stringValue(),
          },
        },
      },
    },
  })

  const author = yield select(usernameSelector)
  if (sent && author) {
    const outboxID = Constants.outboxIDToKey(sent.outboxID)
    const hasPendingFailure = yield select(Shared.pendingFailureSelector, outboxID)
    const message: Constants.Message = {
      author,
      conversationIDKey: action.payload.conversationIDKey,
      deviceName: '',
      deviceType: isMobile ? 'mobile' : 'desktop',
      editedCount: 0,
      failureDescription: hasPendingFailure,
      key: Constants.messageKey(action.payload.conversationIDKey, 'outboxIDText', outboxID),
      message: new HiddenString(action.payload.text.stringValue()),
      messageState: hasPendingFailure ? 'failed' : 'pending',
      outboxID,
      senderDeviceRevokedAt: null,
      timestamp: Date.now(),
      type: 'Text',
      you: author,
    }

    const selectedConversation = yield select(Constants.getSelectedConversation)
    const appFocused = yield select(Shared.focusedSelector)

    yield put(
      Creators.appendMessages(conversationIDKey, conversationIDKey === selectedConversation, appFocused, [
        message,
      ])
    )
    if (hasPendingFailure) {
      yield put(Creators.removePendingFailure(outboxID))
    }
  }
}

function* editMessage(action: Constants.EditMessage): SagaGenerator<any, any> {
  const {message} = action.payload
  let messageID: ?Constants.MessageID
  let conversationIDKey: Constants.ConversationIDKey = ''
  switch (message.type) {
    case 'Text':
    case 'Attachment': // fallthrough
      conversationIDKey = message.conversationIDKey
      messageID = message.messageID
      break
  }

  if (!messageID) {
    console.warn('Editing unknown message type', message)
    return
  }

  const clientHeader = yield call(Shared.clientHeader, ChatTypes.CommonMessageType.edit, conversationIDKey)
  const conversationState = yield select(Shared.conversationStateSelector, conversationIDKey)
  let lastMessageID
  if (conversationState) {
    const message = conversationState.messages.findLast(m => !!m.messageID)
    if (message) {
      lastMessageID = message.messageID
    }
  }

  // Not editing anymore
  yield put(Creators.showEditor(null))

  yield call(ChatTypes.localPostEditNonblockRpcPromise, {
    param: {
      body: action.payload.text.stringValue(),
      clientPrev: lastMessageID,
      conv: clientHeader.conv,
      conversationID: Constants.keyToConversationID(conversationIDKey),
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      supersedes: messageID,
      tlfName: clientHeader.tlfName,
      tlfPublic: clientHeader.tlfPublic,
    },
  })
}

function* retryMessage(action: Constants.RetryMessage): SagaGenerator<any, any> {
  const {conversationIDKey, outboxIDKey} = action.payload
  yield put(Creators.updateTempMessage(conversationIDKey, {messageState: 'pending'}, outboxIDKey))
  yield call(ChatTypes.localRetryPostRpcPromise, {param: {outboxID: Constants.keyToOutboxID(outboxIDKey)}})
}

export {deleteMessage, editMessage, postMessage, retryMessage}
