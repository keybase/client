// @flow
import MessageText from './text'
import React from 'react'
import {Box} from '../../../common-adapters'

import type {Message} from '../../../constants/chat'

const factory = (message: Message, index: number, key: string, style: Object, isScrolling: boolean) => {
  if (!message) {
    return <Box key={key} style={style} />
  }

  switch (message.type) {
    case 'Text':
      return <MessageText style={style} key={key} {...message} />
    default:
      return <Box key={key} style={style} />
  }
}

export default factory
