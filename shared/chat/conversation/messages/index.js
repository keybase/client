// @flow
import * as ChatConstants from '../../../constants/chat'
import AttachmentMessageRender from './attachment'
import MessageText from './text'
import React from 'react'
import Timestamp from './timestamp'
import {Box, Text} from '../../../common-adapters'
import {formatTimeForMessages} from '../../../util/timestamp'
import {globalStyles, globalColors} from '../../../styles'

import type {Message, AttachmentMessage, ServerMessage, MetaDataMap, FollowingMap, OutboxIDKey} from '../../../constants/chat'

type Options = {
  message: Message,
  includeHeader: boolean,
  key: string,
  isFirstNewMessage: boolean,
  style: Object,
  isScrolling: boolean,
  onAction: (message: ServerMessage, event: any) => void,
  isSelected: boolean,
  onLoadAttachment: (messageID: ChatConstants.MessageID, filename: string) => void,
  onOpenInFileUI: (path: string) => void,
  onOpenInPopup: (message: AttachmentMessage) => void,
  onRetry: (outboxID: OutboxIDKey) => void,
  onRetryAttachment: () => void,
  you: string,
  metaDataMap: MetaDataMap,
  followingMap: FollowingMap,
}

const factory = (options: Options) => {
  const {
    message,
    includeHeader,
    key,
    isFirstNewMessage,
    style,
    onAction,
    isSelected,
    onLoadAttachment,
    onOpenInFileUI,
    onOpenInPopup,
    onRetry,
    onRetryAttachment,
    you,
    metaDataMap,
    followingMap,
  } = options

  if (!message) {
    return <Box key={key} style={style} />
  }

  switch (message.type) {
    case 'Text':
      return <MessageText
        key={key}
        you={you}
        metaDataMap={metaDataMap}
        followingMap={followingMap}
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
        key={message.key}
        style={style}
        />
    case 'Attachment':
      return <AttachmentMessageRender
        key={key}
        style={style}
        you={you}
        metaDataMap={metaDataMap}
        followingMap={followingMap}
        message={message}
        onRetry={onRetryAttachment}
        includeHeader={includeHeader}
        isFirstNewMessage={isFirstNewMessage}
        onLoadAttachment={onLoadAttachment}
        onOpenInFileUI={onOpenInFileUI}
        onOpenInPopup={onOpenInPopup}
        messageID={message.messageID}
        onAction={onAction}
        />
    case 'Error':
      return (
        <Box key={key} style={{...style, ...errorStyle}}>
          <Text type='BodySmallItalic' key={key} style={{color: globalColors.red}}>{message.reason}</Text>
        </Box>
      )
    case 'InvisibleError':
      return <Box key={key} style={style} data-msgType={message.type} />
    default:
      return <Box key={key} style={style} data-msgType={message.type} />
  }
}

const errorStyle = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  padding: 5,
}

export default factory
