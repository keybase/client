// @flow
import MessageText from './text'
import React from 'react'
import {Box} from '../../../common-adapters'

import type {Message} from '../../../constants/chat'

const factory = (message: Message, index: number, key: string, style: Object, isScrolling: boolean) => {
  if (!message) {
    return <Box key={key || index} />
  }

  // switch (message.type) {} // TODO types
  return <MessageText style={style} key={key} {...message} />
}

export default factory
