// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import {Map} from 'immutable'
import {TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {getInboxAndUnbox} from './inbox'
import {pendingToRealConversation, replaceConversation, selectConversation} from './creators'
import {usernameSelector} from '../../constants/selectors'

import type {TypedState} from '../../constants/reducer'

type TimestampableMessage = {
  timestamp: number,
  messageID: Constants.MessageID,
  type: any,
}

function followingSelector (state: TypedState) { return state.config.following }
function alwaysShowSelector (state: TypedState) { return state.chat.get('alwaysShow') }
function metaDataSelector (state: TypedState) { return state.chat.get('metaData') }
function routeSelector (state: TypedState) { return state.routeTree.get('routeState').get('selected') }
function focusedSelector (state: TypedState) { return state.chat.get('focused') }
function pendingFailureSelector (state: TypedState, outboxID: Constants.OutboxIDKey) { return state.chat.get('pendingFailures').get(outboxID) }

function conversationStateSelector (state: TypedState, conversationIDKey: Constants.ConversationIDKey) {
  return state.chat.get('conversationStates', Map()).get(conversationIDKey)
}

function messageSelector (state: TypedState, conversationIDKey: Constants.ConversationIDKey, messageID: Constants.MessageID) {
  return conversationStateSelector(state, conversationIDKey).get('messages').find(m => m.messageID === messageID)
}

function messageOutboxIDSelector (state: TypedState, conversationIDKey: Constants.ConversationIDKey, outboxID: Constants.OutboxIDKey) {
  return conversationStateSelector(state, conversationIDKey).get('messages').find(m => m.outboxID === outboxID)
}

function devicenameSelector (state: TypedState) {
  return state.config && state.config.extendedConfig && state.config.extendedConfig.device && state.config.extendedConfig.device.name
}

function selectedInboxSelector (state: TypedState, conversationIDKey: Constants.ConversationIDKey) {
  return state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === conversationIDKey)
}

function tmpFileName (isHdPreview: boolean, conversationID: Constants.ConversationIDKey, messageID: ?Constants.MessageID, filename: string) {
  return `kbchat-${isHdPreview ? 'hdPreview' : 'preview'}-${conversationID}-${messageID || ''}-${filename}`
}

function * clientHeader (messageType: ChatTypes.MessageType, conversationIDKey: Constants.ConversationIDKey): Generator<any, ?ChatTypes.MessageClientHeader, any> {
  const infoSelector = (state: TypedState) => {
    const convo = state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === conversationIDKey)
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

  return {
    conv: info.triple,
    tlfName: info.tlfName,
    tlfPublic: info.visibility === ChatTypes.CommonTLFVisibility.public,
    messageType,
    supersedes: 0,
    sender: Buffer.from(uid, 'hex'),
    senderDevice: Buffer.from(deviceID, 'hex'),
  }
}

const appendMessageActionTransformer = (action: Constants.AppendMessages) => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    messages: action.payload.messages.map(safeServerMessageMap),
  },
  type: action.type,
})

const safeServerMessageMap = (m: any) => ({
  key: m.key,
  messageID: m.messageID,
  messageState: m.messageState,
  outboxID: m.outboxID,
  type: m.type,
})

const prependMessagesActionTransformer = (action: Constants.PrependMessages) => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    hasPaginationNext: !!action.payload.paginationNext,
    messages: action.payload.messages.map(safeServerMessageMap),
    moreToLoad: action.payload.moreToLoad,
  },
  type: action.type,
})

// Actually start a new conversation. conversationIDKey can be a pending one or a replacement
function * startNewConversation (oldConversationIDKey: Constants.ConversationIDKey): Generator<any, ?Constants.ConversationIDKey, any> {
  // Find the participants
  const pendingTlfName = Constants.pendingConversationIDKeyToTlfName(oldConversationIDKey)
  let tlfName
  if (pendingTlfName) {
    tlfName = pendingTlfName
  } else {
    const existing = yield select(selectedInboxSelector, oldConversationIDKey)
    if (existing) {
      tlfName = existing.get('participants').join(',')
    }
  }

  if (!tlfName) {
    console.warn("Shouldn't happen in practice")
    return null
  }

  const result = yield call(ChatTypes.localNewConversationLocalRpcPromise, {
    param: {
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      tlfName,
      tlfVisibility: ChatTypes.CommonTLFVisibility.private,
      topicType: ChatTypes.CommonTopicType.chat,
    }})

  const newConversationIDKey = result ? Constants.conversationIDToKey(result.conv.info.id) : null
  if (!newConversationIDKey) {
    console.warn('No convoid from newConvoRPC')
    return null
  }

  // Replace any existing convo
  if (pendingTlfName) {
    yield put(pendingToRealConversation(oldConversationIDKey, newConversationIDKey))
  } else {
    yield put(replaceConversation(oldConversationIDKey, newConversationIDKey))
  }

  // Select the new version if the old one was selected
  const selectedConversation = yield select(Constants.getSelectedConversation)
  if (selectedConversation === oldConversationIDKey) {
    yield put(selectConversation(newConversationIDKey, false))
  }
  // Load the inbox so we can post, we wait till this is done
  yield call(getInboxAndUnbox, {payload: {conversationIDKey: newConversationIDKey}, type: 'chat:getInboxAndUnbox'})
  return newConversationIDKey
}

// If we're showing a banner we send chatGui, if we're not we send chatGuiStrict
function * getPostingIdentifyBehavior (conversationIDKey: Constants.ConversationIDKey): Generator<any, any, any> {
  const metaData = ((yield select(metaDataSelector)): any)
  const inbox = yield select(selectedInboxSelector, conversationIDKey)
  const you = yield select(usernameSelector)

  if (inbox && you) {
    const brokenUsers = Constants.getBrokenUsers(inbox.get('participants').toArray(), you, metaData)
    return brokenUsers.length ? TlfKeysTLFIdentifyBehavior.chatGui : TlfKeysTLFIdentifyBehavior.chatGuiStrict
  }

  // Shouldn't happen but fallback to strict mode
  if (__DEV__) {
    console.warn('Missing inbox or you when posting')
  }
  return TlfKeysTLFIdentifyBehavior.chatGuiStrict
}

function _filterTimestampableMessage (message: Constants.Message): ?TimestampableMessage {
  if (message.messageID === 1) {
    // $FlowIssue with casting todo(mm) can we fix this?
    return message
  }

  if (message === null || message.type === 'Timestamp' || ['Timestamp', 'Deleted', 'Unhandled', 'InvisibleError', 'Edit'].includes(message.type)) {
    return null
  }

  if (!message.timestamp) {
    return null
  }

  // $FlowIssue with casting todo(mm) can we fix this?
  return message
}

function maybeAddTimestamp (_message: Constants.Message, _prevMessage: Constants.Message): Constants.MaybeTimestamp {
  const prevMessage = _filterTimestampableMessage(_prevMessage)
  const message = _filterTimestampableMessage(_message)
  if (!message || !prevMessage) return null

  // messageID 1 is an unhandled placeholder. We want to add a timestamp before
  // the first message, as well as between any two messages with long duration.
  if (prevMessage.messageID === 1 || message.timestamp - prevMessage.timestamp > Constants.howLongBetweenTimestampsMs) {
    return {
      type: 'Timestamp',
      timestamp: message.timestamp,
      key: Constants.messageKey('timestamp', message.timestamp),
    }
  }
  return null
}

export {
  alwaysShowSelector,
  appendMessageActionTransformer,
  clientHeader,
  conversationStateSelector,
  devicenameSelector,
  focusedSelector,
  followingSelector,
  getPostingIdentifyBehavior,
  maybeAddTimestamp,
  messageOutboxIDSelector,
  messageSelector,
  metaDataSelector,
  pendingFailureSelector,
  prependMessagesActionTransformer,
  routeSelector,
  selectedInboxSelector,
  startNewConversation,
  tmpFileName,
}
