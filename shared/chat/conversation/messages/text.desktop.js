// @flow
import React, {PureComponent} from 'react'
import {Markdown} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import MessageComponent from './shared.desktop'

import type {Props} from './text'
import type {TextMessage} from '../../../constants/chat'

const MessageText = ({message, style}: {message: TextMessage, style: Object}) => {
  const text = message.message.stringValue()
  switch (message.messageState) {
    case 'failed':
    case 'pending':
      return <Markdown style={{color: globalColors.black_40, ...globalStyles.selectable, ...style}}>{text}</Markdown>
    case 'sent':
    default:
      return <Markdown style={{...globalStyles.selectable, ...style}}>{text}</Markdown>
  }
}

export default class MessageTextComponent extends PureComponent<void, Props & {onIconClick: (event: any) => void}, void> {
  render () {
    const {message} = this.props

    return (
      <MessageComponent {...this.props}>
        <MessageText message={message} style={_messageTextStyle} />
      </MessageComponent>
    )
  }
}

const _messageTextStyle = {
  marginTop: globalMargins.xtiny,
  flex: 1,
}
