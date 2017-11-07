// @flow
import * as Constants from '../../constants/chat'
import * as I from 'immutable'
import {chatTab} from '../../constants/tabs'
import {setRouteState} from '../route-tree'

import type {SetRouteState} from '../../constants/route-tree'

// Whitelisted action loggers
const updateTempMessageTransformer = ({
  type,
  payload: {conversationIDKey, outboxID},
}: Constants.UpdateTempMessage) => ({
  payload: {conversationIDKey, outboxID},
  type,
})

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

export {retryAttachment, setSelectedRouteState, updateTempMessage}
