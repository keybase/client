// @flow
import React from 'react'
import {Text} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import MessageWrapper from './wrapper'

import type {Props} from './text'

const MessageText = (props: Props) => {
  const {message} = props
  const {messageState} = message
  const textStyle = messageState === 'failed' || messageState === 'pending' ? pendingFailStyle : {}
  return (
    <MessageWrapper {...props}>
      <Text type='Body' style={textStyle}>{message.message.stringValue()}</Text>
    </MessageWrapper>
  )
}

const pendingFailStyle = {
  color: globalColors.black_40,
}

export default MessageText
