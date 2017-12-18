// @flow
// Actions around sending / editing / deleting messages
import * as I from 'immutable'
import * as RPCChatTypes from '../../constants/types/flow-types-chat'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Constants from '../../constants/chat'
import * as Types from '../../constants/types/chat'
import * as ChatGen from '../chat-gen'
import * as Shared from './shared'
import * as Saga from '../../util/saga'
import HiddenString from '../../util/hidden-string'
import {isMobile} from '../../constants/platform'
import {enableActionLogging} from '../../local-debug'
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
  const conversationIDKey: Types.ConversationIDKey = attrs.conversationIDKey
  const messageID: Types.ParsedMessageID = Constants.parseMessageID(attrs.messageID)
  const state: TypedState = yield Saga.select()

  if (messageID.type === 'rpcMessageID') {
    const inboxConvo = Constants.getInbox(state, conversationIDKey)
    const lastMessageID = Constants.lastMessageID(state, conversationIDKey)
    // Deleting a server message.
    yield Saga.put(navigateTo([], [chatTab, conversationIDKey]))

    if (!inboxConvo) {
      console.warn('Deleting message for non-existent inbox:', message)
      return
    }
    if (!inboxConvo.name) {
      console.warn('Deleting message for non-existent TLF:', message)
      return
    }
    const tlfName: string = inboxConvo.name

    const parsedMessageID = lastMessageID ? Constants.parseMessageID(lastMessageID) : null
    const clientPrev = parsedMessageID && parsedMessageID.type === 'rpcMessageID' ? parsedMessageID.msgID : 0

    const outboxID = yield Saga.call(RPCChatTypes.localGenerateOutboxIDRpcPromise)
    const param: RPCChatTypes.LocalPostDeleteNonblockRpcParam = {
      clientPrev,
      conversationID: Constants.keyToConversationID(conversationIDKey),
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      outboxID,
      supersedes: messageID.msgID,
      tlfName,
      tlfPublic: false,
    }
    yield Saga.call(RPCChatTypes.localPostDeleteNonblockRpcPromise, param)
  } else if (messageID.type === 'outboxID') {
    // Deleting a local outbox message.
    const outboxID = message.outboxID
    if (!outboxID) throw new Error('No outboxID for pending message delete')

    yield Saga.call(RPCChatTypes.localCancelPostRpcPromise, {
      outboxID: Constants.keyToOutboxID(outboxID),
    })
    // It's deleted, but we don't get notified that the conversation now has
    // one less outbox entry in it.  Gotta remove it from the store ourselves.
    yield Saga.put(ChatGen.createRemoveOutboxMessage({conversationIDKey, outboxID}))
  } else {
    console.warn('Deleting message without RPC or outbox message ID:', message, messageID)
  }
}

function* postMessage(action: ChatGen.PostMessagePayload): SagaGenerator<any, any> {
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
  const state: TypedState = yield Saga.select()

  const inSearch = state.chat.get('inSearch')
  if (inSearch) {
    yield Saga.put(ChatGen.createExitSearch({skipSelectPreviousConversation: false}))
  }

  const inboxConvo = Constants.getInbox(state, conversationIDKey)
  const lastMessageID = Constants.lastMessageID(state, conversationIDKey)
  const outboxID = yield Saga.call(RPCChatTypes.localGenerateOutboxIDRpcPromise)
  const author = usernameSelector(state)
  if (!author) {
    console.warn('post message after logged out?')
    return
  }
  const outboxIDKey = Constants.outboxIDToKey(outboxID)
  const lastOrd = Constants.lastOrdinal(state, conversationIDKey)

  const message: Types.TextMessage = {
    author,
    channelMention: 'None',
    conversationIDKey: conversationIDKey,
    deviceName: '',
    deviceType: isMobile ? 'mobile' : 'desktop',
    editedCount: 0,
    failureDescription: '',
    key: Constants.messageKey(conversationIDKey, 'outboxIDText', outboxIDKey),
    mentions: I.Set(),
    message: new HiddenString(action.payload.text.stringValue()),
    messageState: 'pending',
    ordinal: Constants.nextFractionalOrdinal(lastOrd),
    outboxID: outboxIDKey,
    rawMessageID: -1,
    senderDeviceRevokedAt: null,
    timestamp: Date.now(),
    type: 'Text',
    you: author,
  }

  const selectedConversation = Constants.getSelectedConversation(state)
  const appFocused = Shared.focusedSelector(state)

  yield Saga.put(
    ChatGen.createAppendMessages({
      conversationIDKey,
      isAppFocused: appFocused,
      isSelected: conversationIDKey === selectedConversation,
      messages: [message],
      svcShouldDisplayNotification: false,
    })
  )

  const parsedMessageID = lastMessageID ? Constants.parseMessageID(lastMessageID) : null
  const clientPrev = parsedMessageID && parsedMessageID.type === 'rpcMessageID' ? parsedMessageID.msgID : 0

  yield Saga.call(RPCChatTypes.localPostTextNonblockRpcPromise, {
    body: action.payload.text.stringValue(),
    clientPrev,
    conversationID: Constants.keyToConversationID(conversationIDKey),
    identifyBehavior: yield Saga.call(Shared.getPostingIdentifyBehavior, conversationIDKey),
    outboxID,
    tlfName: (inboxConvo ? inboxConvo.name : newConvoTlfName) || '',
    tlfPublic: false,
  })
}

function* editMessage(action: ChatGen.EditMessagePayload): SagaGenerator<any, any> {
  const {message} = action.payload
  if (message.type !== 'Text') {
    console.warn('Editing non-text message:', message)
    return
  }
  const textMessage = (message: Types.TextMessage)
  const attrs = Constants.splitMessageIDKey(textMessage.key)
  const conversationIDKey: Types.ConversationIDKey = attrs.conversationIDKey
  const messageID: Types.ParsedMessageID = Constants.parseMessageID(attrs.messageID)
  if (messageID.type !== 'rpcMessageID') {
    console.warn('Editing message without RPC message ID:', message, messageID)
    return
  }
  let supersedes: RPCChatTypes.MessageID = messageID.msgID

  const state: TypedState = yield Saga.select()
  const inboxConvo = Constants.getInbox(state, conversationIDKey)
  const lastMessageID = Constants.lastMessageID(state, conversationIDKey)

  let clientPrev: RPCChatTypes.MessageID
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

  if (!inboxConvo) {
    console.warn('Editing message for non-existent inbox:', message)
    return
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

  const outboxID = yield Saga.call(RPCChatTypes.localGenerateOutboxIDRpcPromise)
  const param: RPCChatTypes.LocalPostEditNonblockRpcParam = {
    body: newMessageText,
    clientPrev,
    conversationID: Constants.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    outboxID,
    supersedes,
    tlfName,
    tlfPublic: false,
  }
  yield Saga.call(RPCChatTypes.localPostEditNonblockRpcPromise, param)
}

function* retryMessage(action: ChatGen.RetryMessagePayload): SagaGenerator<any, any> {
  const {conversationIDKey, outboxIDKey} = action.payload
  yield Saga.put(
    ChatGen.createUpdateTempMessage({conversationIDKey, message: {messageState: 'pending'}, outboxIDKey})
  )
  yield Saga.call(RPCChatTypes.localRetryPostRpcPromise, {
    outboxID: Constants.keyToOutboxID(outboxIDKey),
  })
}

function _logPostMessage(action: ChatGen.PostMessagePayload) {
  const toPrint = {
    payload: {conversationIDKey: action.payload.conversationIDKey},
    type: action.type,
  }

  console.log('Posting message', JSON.stringify(toPrint, null, 2))
}

function _logRetryMessage(action: ChatGen.RetryMessagePayload) {
  const toPrint = {
    payload: {
      conversationIDKey: action.payload.conversationIDKey,
      outboxIDKey: action.payload.outboxIDKey,
    },
    type: action.type,
  }
  console.log('Retrying message', JSON.stringify(toPrint, null, 2))
}

function* registerSagas(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(ChatGen.deleteMessage, deleteMessage)
  yield Saga.safeTakeEvery(ChatGen.editMessage, editMessage)
  yield Saga.safeTakeEvery(ChatGen.postMessage, postMessage)
  yield Saga.safeTakeEvery(ChatGen.retryMessage, retryMessage)

  if (enableActionLogging) {
    yield Saga.safeTakeEveryPure(ChatGen.postMessage, _logPostMessage)
    yield Saga.safeTakeEveryPure(ChatGen.retryMessage, _logRetryMessage)
  }
}

export {registerSagas}
