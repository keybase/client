// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import {Map} from 'immutable'
import {TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {unboxConversations} from './inbox'
import {pendingToRealConversation, replaceConversation, selectConversation} from './creators'
import {usernameSelector} from '../../constants/selectors'

import type {TypedState} from '../../constants/reducer'

function followingSelector(state: TypedState) {
  return state.config.following
}
function alwaysShowSelector(state: TypedState) {
  return state.chat.get('alwaysShow')
}
function metaDataSelector(state: TypedState) {
  return state.chat.get('metaData')
}
function routeSelector(state: TypedState) {
  return state.routeTree.get('routeState').get('selected')
}
function focusedSelector(state: TypedState) {
  return state.config.appFocused
}
function pendingFailureSelector(state: TypedState, outboxID: Constants.OutboxIDKey) {
  return state.chat.get('pendingFailures').get(outboxID)
}

function conversationStateSelector(state: TypedState, conversationIDKey: Constants.ConversationIDKey) {
  return state.chat.get('conversationStates', Map()).get(conversationIDKey)
}

function messageSelector(
  state: TypedState,
  conversationIDKey: Constants.ConversationIDKey,
  messageID: Constants.MessageID
) {
  return conversationStateSelector(state, conversationIDKey)
    .get('messages')
    .find(m => m.messageID === messageID)
}

function messageOutboxIDSelector(
  state: TypedState,
  conversationIDKey: Constants.ConversationIDKey,
  outboxID: Constants.OutboxIDKey
) {
  return conversationStateSelector(state, conversationIDKey)
    .get('messages')
    .find(m => m.outboxID === outboxID)
}

function devicenameSelector(state: TypedState) {
  return state.config && state.config.deviceName
}

function selectedInboxSelector(state: TypedState, conversationIDKey: Constants.ConversationIDKey) {
  return state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === conversationIDKey)
}

function attachmentPlaceholderPreviewSelector(state: TypedState, outboxID: Constants.OutboxIDKey) {
  return state.chat.get('attachmentPlaceholderPreviews', Map()).get(outboxID)
}

function inboxUntrustedStateSelector(state: TypedState) {
  return state.chat.get('inboxUntrustedState')
}

function tmpFileName(
  isPreview: boolean,
  conversationID: Constants.ConversationIDKey,
  messageID: Constants.MessageID
) {
  if (!messageID) {
    throw new Error('tmpFileName called without messageID!')
  }

  return `kbchat-${conversationID}-${messageID}.${isPreview ? 'preview' : 'download'}`
}

function* clientHeader(
  messageType: ChatTypes.MessageType,
  conversationIDKey: Constants.ConversationIDKey
): Generator<any, ?ChatTypes.MessageClientHeader, any> {
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

  return {
    conv: info.triple,
    tlfName: info.tlfName,
    tlfPublic: info.visibility === ChatTypes.CommonTLFVisibility.public,
    messageType,
    supersedes: 0,
    sender: null,
    senderDevice: null,
  }
}

// Actually start a new conversation. conversationIDKey can be a pending one or a replacement
function* startNewConversation(
  oldConversationIDKey: Constants.ConversationIDKey
): Generator<any, ?Constants.ConversationIDKey, any> {
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
    },
  })

  const newConversationIDKey = result ? Constants.conversationIDToKey(result.conv.info.id) : null
  if (!newConversationIDKey) {
    console.warn('No convoid from newConvoRPC')
    return null
  }

  // Replace any existing convo
  if (pendingTlfName) {
    yield put(pendingToRealConversation(oldConversationIDKey, newConversationIDKey))
  } else if (oldConversationIDKey !== newConversationIDKey) {
    yield put(replaceConversation(oldConversationIDKey, newConversationIDKey))
  }

  // Select the new version if the old one was selected
  const selectedConversation = yield select(Constants.getSelectedConversation)
  if (selectedConversation === oldConversationIDKey) {
    yield put(selectConversation(newConversationIDKey, false))
  }
  // Load the inbox so we can post, we wait till this is done
  yield call(unboxConversations, [newConversationIDKey])
  return newConversationIDKey
}

// If we're showing a banner we send chatGui, if we're not we send chatGuiStrict
function* getPostingIdentifyBehavior(
  conversationIDKey: Constants.ConversationIDKey
): Generator<any, any, any> {
  const metaData = (yield select(metaDataSelector): any)
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

export {
  alwaysShowSelector,
  attachmentPlaceholderPreviewSelector,
  clientHeader,
  conversationStateSelector,
  devicenameSelector,
  focusedSelector,
  followingSelector,
  getPostingIdentifyBehavior,
  inboxUntrustedStateSelector,
  messageOutboxIDSelector,
  messageSelector,
  metaDataSelector,
  pendingFailureSelector,
  routeSelector,
  selectedInboxSelector,
  startNewConversation,
  tmpFileName,
}
