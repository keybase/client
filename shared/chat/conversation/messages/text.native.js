// @flow
import React from 'react'
import {Markdown} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import MessageWrapper from './wrapper'

import type {Props} from './text'

const MessageText = (props: Props) => {
  const {message, isEditing} = props
  const {messageState} = message
  const textStyle = {
    backgroundColor: globalColors.white,
    color: globalColors.black,
    ...(messageState === 'failed' || messageState === 'pending' ? pendingFailStyle : {}),
    ...(isEditing ? editingStyle : null),
  }

  return (
    <MessageWrapper {...props}>
      <Markdown style={textStyle}>{message.message.stringValue()}</Markdown>
    </MessageWrapper>
  )
}

const editingStyle = {
  borderColor: globalColors.blue,
  borderRadius: 8,
  borderWidth: 1,
  margin: 2,
  padding: 2,
}

const pendingFailStyle = {
  color: globalColors.black_40,
}

export default MessageText
