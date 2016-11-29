// @flow
import MessageText from './text'
import Timestamp from './timestamp'
import {formatTimeForMessages} from '../../../util/timestamp'
import React from 'react'
import {Box} from '../../../common-adapters'

import type {Message} from '../../../constants/chat'

const factory = (message: Message, includeHeader: boolean, index: number, key: string, isFirstNewMessage: boolean, style: Object, isScrolling: boolean, onAction: (event: any) => void, isSelected: boolean) => {
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
        onRetry={() => console.log('todo, hookup onRetry')}
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
    default:
      return <Box key={key} style={style} />
  }
}

export default factory
