// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import AttachmentMessage from './attachment/container'
import TextMessage from './text/container'
import type {Position} from '../../../../common-adapters/relative-popup-hoc'

type Props = {
  attachTo: ?React.Component<any, any>,
  message: Types.MessageText | Types.MessageAttachment,
  onHidden: () => void,
  position: Position,
  visible: boolean,
}

class MessageAction extends React.PureComponent<Props> {
  render() {
    return this.props.message.type === 'text' ? (
      <TextMessage
        attachTo={this.props.attachTo}
        message={this.props.message}
        onHidden={this.props.onHidden}
        position={this.props.position}
        visible={this.props.visible}
      />
    ) : (
      <AttachmentMessage
        attachTo={this.props.attachTo}
        message={this.props.message}
        onHidden={this.props.onHidden}
        position={this.props.position}
        visible={this.props.visible}
      />
    )
  }
}

export default MessageAction
