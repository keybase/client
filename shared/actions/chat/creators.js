// @flow
import * as RPCTypes from '../../constants/types/flow-types'
import * as Constants from '../../constants/chat'
import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'
import {chatTab} from '../../constants/tabs'
import {setRouteState} from '../route-tree'
import uniq from 'lodash/uniq'

import type {SetRouteState} from '../../constants/route-tree'

// Whitelisted action loggers
const updateTempMessageTransformer = ({
  type,
  payload: {conversationIDKey, outboxID},
}: Constants.UpdateTempMessage) => ({
  payload: {conversationIDKey, outboxID},
  type,
})

const safeServerMessageMap = (m: any) => ({
  key: m.key,
  messageID: m.messageID,
  messageState: m.messageState,
  outboxID: m.outboxID,
  type: m.type,
})

const appendMessageActionTransformer = (action: Constants.AppendMessages) => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    messages: action.payload.messages.map(safeServerMessageMap),
    svcShouldDisplayNotification: action.payload.svcShouldDisplayNotification,
  },
  type: action.type,
})

const prependMessagesActionTransformer = (action: Constants.PrependMessages) => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    messages: action.payload.messages.map(safeServerMessageMap),
    moreToLoad: action.payload.moreToLoad,
  },
  type: action.type,
})

const postMessageActionTransformer = action => ({
  payload: {conversationIDKey: action.payload.conversationIDKey},
  type: action.type,
})

const retryMessageActionTransformer = action => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    outboxIDKey: action.payload.outboxIDKey,
  },
  type: action.type,
})

const attachmentLoadedTransformer = ({
  type,
  payload: {messageKey, isPreview},
}: Constants.AttachmentLoaded) => ({
  payload: {
    messageKey,
    isPreview,
  },
  type,
})

const downloadProgressTransformer = ({
  type,
  payload: {messageKey, isPreview, progress},
}: Constants.DownloadProgress) => ({
  payload: {
    messageKey,
    isPreview,
    progress: progress === 0 ? 'zero' : progress === 1 ? 'one' : 'partial',
  },
  type,
})

const loadAttachmentPreviewTransformer = ({
  type,
  payload: {messageKey},
}: Constants.LoadAttachmentPreview) => ({
  payload: {
    messageKey,
  },
  type,
})

function badgeAppForChat(conversations: ?Array<RPCTypes.BadgeConversationInfo>): Constants.BadgeAppForChat {
  const convos = I.List(
    (conversations || []).map(conversation => Constants.ConversationBadgeStateRecord(conversation))
  )
  return {payload: convos, type: 'chat:badgeAppForChat'}
}

function startConversation(
  users: Array<string>,
  forceImmediate?: boolean = false,
  temporary?: boolean = false
): Constants.StartConversation {
  return {
    payload: {forceImmediate, users: uniq(users), temporary},
    type: 'chat:startConversation',
  }
}

function postMessage(
  conversationIDKey: Constants.ConversationIDKey,
  text: HiddenString
): Constants.PostMessage {
  return {
    logTransformer: postMessageActionTransformer,
    payload: {conversationIDKey, text},
    type: 'chat:postMessage',
  }
}

function retryMessage(
  conversationIDKey: Constants.ConversationIDKey,
  outboxIDKey: string
): Constants.RetryMessage {
  return {
    logTransformer: retryMessageActionTransformer,
    payload: {conversationIDKey, outboxIDKey},
    type: 'chat:retryMessage',
  }
}

function appendMessages(
  conversationIDKey: Constants.ConversationIDKey,
  isSelected: boolean,
  isAppFocused: boolean,
  messages: Array<Constants.ServerMessage>,
  svcShouldDisplayNotification: boolean
): Constants.AppendMessages {
  return {
    logTransformer: appendMessageActionTransformer,
    payload: {
      conversationIDKey,
      isAppFocused,
      isSelected,
      messages,
      svcShouldDisplayNotification,
    },
    type: 'chat:appendMessages',
  }
}

function prependMessages(
  conversationIDKey: Constants.ConversationIDKey,
  messages: Array<Constants.ServerMessage>,
  moreToLoad: boolean
): Constants.PrependMessages {
  return {
    logTransformer: prependMessagesActionTransformer,
    payload: {conversationIDKey, messages, moreToLoad},
    type: 'chat:prependMessages',
  }
}

function retryAttachment(message: Constants.AttachmentMessage): Constants.RetryAttachment {
  const {conversationIDKey, uploadPath, title, previewType, outboxID} = message
  if (!uploadPath || !title || !previewType) {
    throw new Error('attempted to retry attachment without upload path')
  }
  if (!outboxID) {
    throw new Error('attempted to retry attachment without outboxID')
  }
  const input = {
    conversationIDKey,
    filename: uploadPath,
    title,
    type: previewType || 'Other',
  }
  return {
    payload: {input, oldOutboxID: outboxID},
    type: 'chat:retryAttachment',
  }
}

function loadAttachmentPreview(messageKey: Constants.MessageKey): Constants.LoadAttachmentPreview {
  return {
    logTransformer: loadAttachmentPreviewTransformer,
    payload: {messageKey},
    type: 'chat:loadAttachmentPreview',
  }
}

function attachmentLoaded(
  messageKey: Constants.MessageKey,
  path: ?string,
  isPreview: boolean
): Constants.AttachmentLoaded {
  return {
    logTransformer: attachmentLoadedTransformer,
    payload: {isPreview, messageKey, path},
    type: 'chat:attachmentLoaded',
  }
}

function downloadProgress(
  messageKey: Constants.MessageKey,
  isPreview: boolean,
  progress: ?number
): Constants.DownloadProgress {
  return {
    logTransformer: downloadProgressTransformer,
    payload: {isPreview, messageKey, progress},
    type: 'chat:downloadProgress',
  }
}

function updateTempMessage(
  conversationIDKey: Constants.ConversationIDKey,
  message: $Shape<Constants.AttachmentMessage> | $Shape<Constants.TextMessage>,
  outboxID: Constants.OutboxIDKey
): Constants.UpdateTempMessage {
  return {
    logTransformer: updateTempMessageTransformer,
    payload: {conversationIDKey, message, outboxID},
    type: 'chat:updateTempMessage',
  }
}

function setSelectedRouteState(
  selectedConversation: Constants.ConversationIDKey,
  partialState: Object
): SetRouteState {
  return setRouteState(I.List([chatTab, selectedConversation]), partialState)
}

export {
  appendMessages,
  attachmentLoaded,
  badgeAppForChat,
  downloadProgress,
  loadAttachmentPreview,
  postMessage,
  prependMessages,
  retryAttachment,
  retryMessage,
  setSelectedRouteState,
  startConversation,
  updateTempMessage,
}
