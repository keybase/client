// @flow
import MessageText from './text'
import React from 'react'
import {Box} from '../../../common-adapters'

import type {Message} from '../../../constants/chat'

const factory = (message: Message, includeHeader: boolean, index: number, key: string, style: Object, isScrolling: boolean) => {
  if (!message) {
    return <Box key={key} style={style} />
  }
  // TODO hook up messageState and onRetry

  switch (message.type) {
    case 'Text':
      return <MessageText
        key={key}
        style={style}
        author={message.author}
        onRetry={() => console.log('todo, hookup onRetry')}
        message={message.message.stringValue()}
        followState={message.followState}
        messageState={message.messageState}
        includeHeader={includeHeader}
        />
    default:
      return <Box key={key} style={style} />
  }
}

export default factory
