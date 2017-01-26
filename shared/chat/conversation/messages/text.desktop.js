// @flow
import React, {PureComponent} from 'react'
import {Markdown} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
import MessageComponent from './shared.desktop'

import type {Props} from './text'
import type {TextMessage} from '../../../constants/chat'

const MessageText = ({message}: {message: TextMessage}) => {
  const text = message.message.stringValue()
  switch (message.messageState) {
    case 'failed':
    case 'pending':
      return <Markdown style={pendingFailStyle}>{text}</Markdown>
    case 'sent':
    default:
      return <Markdown style={sentStyle}>{text}</Markdown>
  }
}

export default class MessageTextComponent extends PureComponent<void, Props & {onIconClick: (event: any) => void}, void> {
  render () {
    const {message} = this.props

    if (message.key === 167) {
      console.log('aaa text render')
    }

    return (
      <MessageComponent {...this.props}>
        <MessageText message={message} />
      </MessageComponent>
    )
  }
}

const _messageTextStyle = {
  flex: 1,
  whiteSpace: 'pre-wrap',
}

const sentStyle = {
  ...globalStyles.selectable,
  ..._messageTextStyle,
}

const pendingFailStyle = {
  color: globalColors.black_40,
  ...globalStyles.selectable,
  ..._messageTextStyle,
}
