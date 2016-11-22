// @flow
import MessageText from './text'
import Timestamp from './timestamp'
import moment from 'moment'
import React from 'react'
import {Box} from '../../../common-adapters'

import type {Message} from '../../../constants/chat'

const momentFormatter = (timestamp: number): string => {
  const now = moment()
  const then = moment(timestamp)

  if (now.diff(then, 'months') > 6) {
    return 'MMM DD YYYY HH:mm A' // Jan 5 2016 4:34 PM
  } else if (now.diff(then, 'days') > 6) {
    return 'MMM DD HH:mm A' // Jan 5 4:34 PM
  } else if (now.diff(then, 'hours') > 22) {
    return 'ddd HH:mm A' // Wed 4:34 PM
  } else {
    return 'HH:mm A' // 4:34 PM
  }
}

const timestampWithFormat = (timestamp: number, format: string): string => {
  return moment(timestamp).format(format)
}

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
    case 'Timestamp':
      const timestamp = timestampWithFormat(message.timestamp, momentFormatter(message.timestamp))
      return <Timestamp
        timestamp={timestamp}
        key={message.timestamp}
        style={style}
        />
    default:
      return <Box key={key} style={style} />
  }
}

export default factory
