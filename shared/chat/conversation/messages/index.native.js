// @flow
import * as ChatConstants from '../../../constants/chat'
import React from 'react'
import {Box} from '../../../common-adapters'

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
  return <Box key={options.key} style={options.style} />
}

export default factory
