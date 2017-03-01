// @flow
import * as I from 'immutable'
import MessageWrapper from './wrapper'
import React, {Component} from 'react'
import shallowEqual from 'shallowequal'
import {Markdown} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'

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

class MessageTextComponent extends Component<void, Props & {onIconClick: (event: any) => void}, void> {
  shouldComponentUpdate (nextProps: Props, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'followingMap'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      if (key === 'metaDataMap') {
        return I.is(obj, oth)
      }
      return undefined
    })
  }

  render () {
    const {message} = this.props

    return (
      <MessageWrapper {...this.props}>
        <MessageText message={message} />
      </MessageWrapper>
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

export default MessageTextComponent
