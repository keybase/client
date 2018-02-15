// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import AttachmentMessage from './attachment/container'
import TextMessage from './text/container'

type Props = {
  routeProps: I.RecordOf<{message: Types.MessageText}>,
  onClosePopup: () => void,
}

class MessageAction extends React.PureComponent<Props> {
  render() {
    const message = this.props.routeProps.get('message')
    return message.type === 'text' ? (
      <TextMessage message={message} onClosePopup={this.props.onClosePopup} />
    ) : (
      <AttachmentMessage message={message} onClosePopup={this.props.onClosePopup} />
    )
  }
}

export default MessageAction
