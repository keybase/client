// @flow
import MessageText from './text'
import React from 'react'
import {Box} from '../../../common-adapters'

import type {Message} from '../../../constants/chat'

const factory = (message: Message, includeHeader: boolean, index: number, key: string, style: Object, isScrolling: boolean, onAction: (event: any) => void, isSelected: boolean) => {
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
        isSelected={isSelected}
        onAction={onAction}
        />
    default:
      return <Box key={key} style={style} />
  }
}

export default factory
