// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as I from 'immutable'
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
  if (message.type !== 'Text' && message.type !== 'Attachment') {
    console.warn('Deleting non-text non-attachment message:', message)
    return
  }

  const attrs = Constants.splitMessageIDKey(message.key)
  const conversationIDKey: Constants.ConversationIDKey = attrs.conversationIDKey
  const messageID: Constants.ParsedMessageID = Constants.parseMessageID(attrs.messageID)
  if (messageID.type === 'rpcMessageID') {
    // Deleting a server message.
    const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield all([
      select(Constants.getInbox, conversationIDKey),
      select(Constants.lastMessageID, conversationIDKey),
    ])
    yield put(navigateTo([], [chatTab, conversationIDKey]))

    if (!inboxConvo.name) {
      console.warn('Deleting message for non-existent TLF:', message)
      return
    }
    const tlfName: string = inboxConvo.name

    const outboxID = yield call(ChatTypes.localGenerateOutboxIDRpcPromise)
    const param: ChatTypes.localPostDeleteNonblockRpcParam = {
      clientPrev: lastMessageID ? Constants.parseMessageID(lastMessageID).msgID : 0,
      conversationID: Constants.keyToConversationID(conversationIDKey),
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      outboxID,
      supersedes: messageID.msgID,
      tlfName,
      tlfPublic: false,
    }
    yield call(ChatTypes.localPostDeleteNonblockRpcPromise, {param})
  } else if (messageID.type === 'outboxID') {
    // Deleting a local outbox message.
    const outboxID = message.outboxID
    if (!outboxID) throw new Error('No outboxID for pending message delete')

    yield call(ChatTypes.localCancelPostRpcPromise, {
      param: {outboxID: Constants.keyToOutboxID(outboxID)},
    })
    // It's deleted, but we don't get notified that the conversation now has
    // one less outbox entry in it.  Gotta remove it from the store ourselves.
    yield put(Creators.removeOutboxMessage(conversationIDKey, outboxID))
  } else {
    console.warn('Deleting message without RPC or outbox message ID:', message, messageID)
  }
}

function* postMessage(action: Constants.PostMessage): SagaGenerator<any, any> {
  let {conversationIDKey} = action.payload
  let newConvoTlfName

  if (Constants.isPendingConversationIDKey(conversationIDKey)) {
    // Get a real conversationIDKey
    ;[conversationIDKey, newConvoTlfName] = yield call(Shared.startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  // Note: This should happen *after* startNewConversation, because
  // startNewConversation() uses the presence of a pendingConversation
  // that is deleted by exitSearch().
  const inSearch = yield select((state: TypedState) => state.chat.get('inSearch'))
  if (inSearch) {
    yield put(Creators.exitSearch(false))
  }

  const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield all([
    select(Constants.getInbox, conversationIDKey),
    select(Constants.lastMessageID, conversationIDKey),
  ])

  const outboxID = yield call(ChatTypes.localGenerateOutboxIDRpcPromise)
  const author = yield select(usernameSelector)
  const outboxIDKey = Constants.outboxIDToKey(outboxID)

  const message: Constants.TextMessage = {
    author,
    channelMention: 'None',
    conversationIDKey,
    deviceName: '',
    deviceType: isMobile ? 'mobile' : 'desktop',
    editedCount: 0,
    failureDescription: '',
    key: Constants.messageKey(conversationIDKey, 'outboxIDText', outboxIDKey),
    mentions: I.Set(),
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
      tlfName: inboxConvo ? inboxConvo.name : newConvoTlfName,
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
  if (message.type !== 'Text') {
    console.warn('Editing non-text message:', message)
    return
  }
  const textMessage = (message: Constants.TextMessage)
  const attrs = Constants.splitMessageIDKey(textMessage.key)
  const conversationIDKey: Constants.ConversationIDKey = attrs.conversationIDKey
  const messageID: Constants.ParsedMessageID = Constants.parseMessageID(attrs.messageID)
  if (messageID.type !== 'rpcMessageID') {
    console.warn('Editing message without RPC message ID:', message, messageID)
    return
  }
  let supersedes: ChatTypes.MessageID = messageID.msgID

  const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield all([
    select(Constants.getInbox, conversationIDKey),
    select(Constants.lastMessageID, conversationIDKey),
  ])

  let clientPrev: ChatTypes.MessageID
  if (lastMessageID) {
    const clientPrevMessageID = Constants.parseMessageID(lastMessageID)
    if (clientPrevMessageID.type !== 'rpcMessageID') {
      console.warn('Editing message without RPC last message ID:', message, clientPrevMessageID)
      return
    }

    clientPrev = clientPrevMessageID.msgID
  } else {
    clientPrev = 0
  }

  if (!inboxConvo.name) {
    console.warn('Editing message for non-existent TLF:', message)
    return
  }
  const tlfName: string = inboxConvo.name

  // Not editing anymore
  yield put(Creators.showEditor(null))

  // if message post-edit is the same as message pre-edit, skip call and marking message as 'EDITED'
  const prevMessageText = textMessage.message.stringValue()
  const newMessageText = action.payload.text.stringValue()
  if (prevMessageText === newMessageText) {
    return
  }

  const outboxID = yield call(ChatTypes.localGenerateOutboxIDRpcPromise)
  const param: ChatTypes.localPostEditNonblockRpcParam = {
    body: newMessageText,
    clientPrev,
    conversationID: Constants.keyToConversationID(conversationIDKey),
    identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
    outboxID,
    supersedes,
    tlfName,
    tlfPublic: false,
  }
  yield call(ChatTypes.localPostEditNonblockRpcPromise, {param})
}

function* retryMessage(action: Constants.RetryMessage): SagaGenerator<any, any> {
  const {conversationIDKey, outboxIDKey} = action.payload
  yield put(Creators.updateTempMessage(conversationIDKey, {messageState: 'pending'}, outboxIDKey))
  yield call(ChatTypes.localRetryPostRpcPromise, {
    param: {outboxID: Constants.keyToOutboxID(outboxIDKey)},
  })
}

export {deleteMessage, editMessage, postMessage, retryMessage}
