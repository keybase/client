// @flow
// Actions around sending / editing / deleting messages
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as ChatGen from '../chat-gen'
import * as Shared from './shared'
import * as Saga from '../../util/saga'
import HiddenString from '../../util/hidden-string'
import {TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {isMobile} from '../../constants/platform'
import {usernameSelector} from '../../constants/selectors'
import {navigateTo} from '../../actions/route-tree'
import {chatTab} from '../../constants/tabs'

import type {TypedState} from '../../constants/reducer'
import type {SagaGenerator} from '../../constants/types/saga'

function* deleteMessage(action: ChatGen.DeleteMessagePayload): SagaGenerator<any, any> {
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
    const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield Saga.all([
      Saga.select(Constants.getInbox, conversationIDKey),
      Saga.select(Constants.lastMessageID, conversationIDKey),
    ])
    yield Saga.put(navigateTo([], [chatTab, conversationIDKey]))

    if (!inboxConvo.name) {
      console.warn('Deleting message for non-existent TLF:', message)
      return
    }
    const tlfName: string = inboxConvo.name

    const outboxID = yield Saga.call(ChatTypes.localGenerateOutboxIDRpcPromise)
    const param: ChatTypes.localPostDeleteNonblockRpcParam = {
      clientPrev: lastMessageID ? Constants.parseMessageID(lastMessageID).msgID : 0,
      conversationID: Constants.keyToConversationID(conversationIDKey),
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      outboxID,
      supersedes: messageID.msgID,
      tlfName,
      tlfPublic: false,
    }
    yield Saga.call(ChatTypes.localPostDeleteNonblockRpcPromise, {param})
  } else if (messageID.type === 'outboxID') {
    // Deleting a local outbox message.
    const outboxID = message.outboxID
    if (!outboxID) throw new Error('No outboxID for pending message delete')

    yield Saga.call(ChatTypes.localCancelPostRpcPromise, {
      param: {outboxID: Constants.keyToOutboxID(outboxID)},
    })
    // It's deleted, but we don't get notified that the conversation now has
    // one less outbox entry in it.  Gotta remove it from the store ourselves.
    yield Saga.put(ChatGen.createRemoveOutboxMessage({conversationIDKey, outboxID}))
  } else {
    console.warn('Deleting message without RPC or outbox message ID:', message, messageID)
  }
}

function* postMessage(action: Constants.PostMessage): SagaGenerator<any, any> {
  let {conversationIDKey} = action.payload
  let newConvoTlfName

  if (Constants.isPendingConversationIDKey(conversationIDKey)) {
    // Get a real conversationIDKey
    ;[conversationIDKey, newConvoTlfName] = yield Saga.call(Shared.startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  // Note: This should happen *after* startNewConversation, because
  // startNewConversation() uses the presence of a pendingConversation
  // that is deleted by exitSearch().
  const inSearch = yield Saga.select((state: TypedState) => state.chat.get('inSearch'))
  if (inSearch) {
    yield Saga.put(ChatGen.createExitSearch({skipSelectPreviousConversation: false}))
  }

  const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield Saga.all([
    Saga.select(Constants.getInbox, conversationIDKey),
    Saga.select(Constants.lastMessageID, conversationIDKey),
  ])

  const outboxID = yield Saga.call(ChatTypes.localGenerateOutboxIDRpcPromise)
  const author = yield Saga.select(usernameSelector)
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

  const selectedConversation = yield Saga.select(Constants.getSelectedConversation)
  const appFocused = yield Saga.select(Shared.focusedSelector)

  yield Saga.put(
    Creators.appendMessages(
      conversationIDKey,
      conversationIDKey === selectedConversation,
      appFocused,
      [message],
      false
    )
  )

  yield Saga.call(ChatTypes.localPostTextNonblockRpcPromise, {
    param: {
      conversationID: Constants.keyToConversationID(conversationIDKey),
      tlfName: inboxConvo ? inboxConvo.name : newConvoTlfName,
      tlfPublic: false,
      outboxID,
      body: action.payload.text.stringValue(),
      identifyBehavior: yield Saga.call(Shared.getPostingIdentifyBehavior, conversationIDKey),
      clientPrev: lastMessageID ? Constants.parseMessageID(lastMessageID).msgID : 0,
    },
  })
}

function* editMessage(action: ChatGen.EditMessagePayload): SagaGenerator<any, any> {
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

  const [inboxConvo, lastMessageID]: [Constants.InboxState, ?Constants.MessageID] = yield Saga.all([
    Saga.select(Constants.getInbox, conversationIDKey),
    Saga.select(Constants.lastMessageID, conversationIDKey),
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
  yield Saga.put(ChatGen.createShowEditor({message: null}))

  // if message post-edit is the same as message pre-edit, skip call and marking message as 'EDITED'
  const prevMessageText = textMessage.message.stringValue()
  const newMessageText = action.payload.text.stringValue()
  if (prevMessageText === newMessageText) {
    return
  }

  const outboxID = yield Saga.call(ChatTypes.localGenerateOutboxIDRpcPromise)
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
  yield Saga.call(ChatTypes.localPostEditNonblockRpcPromise, {param})
}

function* retryMessage(action: Constants.RetryMessage): SagaGenerator<any, any> {
  const {conversationIDKey, outboxIDKey} = action.payload
  yield Saga.put(Creators.updateTempMessage(conversationIDKey, {messageState: 'pending'}, outboxIDKey))
  yield Saga.call(ChatTypes.localRetryPostRpcPromise, {
    param: {outboxID: Constants.keyToOutboxID(outboxIDKey)},
  })
}

function* registerSagas(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('chat:deleteMessage', deleteMessage)
  yield Saga.safeTakeEvery('chat:editMessage', editMessage)
  yield Saga.safeTakeEvery('chat:postMessage', postMessage)
  yield Saga.safeTakeEvery('chat:retryMessage', retryMessage)
}

export {registerSagas}
