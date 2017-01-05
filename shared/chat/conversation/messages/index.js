// @flow
import * as ChatConstants from '../../../constants/chat'
import AttachmentMessageRender from './attachment'
import MessageText from './text'
import React from 'react'
import Timestamp from './timestamp'
import {Box} from '../../../common-adapters'
import {formatTimeForMessages} from '../../../util/timestamp'

import type {Message, AttachmentMessage, ServerMessage} from '../../../constants/chat'

const _onRetryTodo = (message: Message) => console.log('todo, hookup attachment onRetry, ', message)

const factory = (message: Message, includeHeader: boolean, index: number, key: string, isFirstNewMessage: boolean, style: Object, isScrolling: boolean, onAction: (message: ServerMessage, event: any) => void, isSelected: boolean, onAttachmentLoaded: (messageID: ChatConstants.MessageID) => void, onLoadAttachment: (messageID: ChatConstants.MessageID, filename: string) => void, onOpenInFileUI: (path: string) => void, onOpenInPopup: (message: AttachmentMessage) => void, onRetry: (outboxID: string) => void) => {
  if (!message) {
    return <Box key={key} style={style} />
  }
  // TODO hook up messageState and onRetry

  switch (message.type) {
    case 'Text':
      return <MessageText
        key={key}
        style={style}
        message={message}
        onRetry={onRetry}
        includeHeader={includeHeader}
        isFirstNewMessage={isFirstNewMessage}
        isSelected={isSelected}
        onAction={onAction}
        />
    case 'Timestamp':
      return <Timestamp
        timestamp={formatTimeForMessages(message.timestamp)}
        key={message.timestamp}
        style={style}
        />
    case 'Attachment':
      return <AttachmentMessageRender
        key={key}
        style={style}
        message={message}
        onRetry={_onRetryTodo}
        includeHeader={includeHeader}
        isFirstNewMessage={isFirstNewMessage}
        onAttachmentLoaded={onAttachmentLoaded}
        onLoadAttachment={onLoadAttachment}
        onOpenInFileUI={onOpenInFileUI}
        onOpenInPopup={onOpenInPopup}
        messageID={message.messageID}
        onAction={onAction}
        />
    default:
      return <Box key={key} style={style} />
  }
}

export default factory
