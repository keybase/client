// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import AttachmentMessage from './attachment/container'
import TextMessage from './text/container'
import ExplodingMessage from './exploding/container'
import PaymentMessage from './payment/container'
import type {Position} from '../../../../common-adapters/relative-popup-hoc'

type Props = {
  attachTo: () => ?React.ElementRef<any>,
  message: Types.DecoratedMessage,
  onHidden: () => void,
  position: Position,
  visible: boolean,
}

class MessageAction extends React.PureComponent<Props> {
  render() {
    switch (this.props.message.type) {
      case 'text':
        if (this.props.message.exploding) {
          return (
            <ExplodingMessage
              attachTo={this.props.attachTo}
              message={this.props.message}
              onHidden={this.props.onHidden}
              position={this.props.position}
              visible={this.props.visible}
            />
          )
        }
        return (
          <TextMessage
            attachTo={this.props.attachTo}
            message={this.props.message}
            onHidden={this.props.onHidden}
            position={this.props.position}
            visible={this.props.visible}
          />
        )
      case 'attachment':
        if (this.props.message.exploding) {
          return (
            <ExplodingMessage
              attachTo={this.props.attachTo}
              message={this.props.message}
              onHidden={this.props.onHidden}
              position={this.props.position}
              visible={this.props.visible}
            />
          )
        }
        return (
          <AttachmentMessage
            attachTo={this.props.attachTo}
            message={this.props.message}
            onHidden={this.props.onHidden}
            position={this.props.position}
            visible={this.props.visible}
          />
        )
      case 'sendPayment':
        return (
          <PaymentMessage
            attachTo={this.props.attachTo}
            message={this.props.message}
            onHidden={this.props.onHidden}
            position={this.props.position}
            visible={this.props.visible}
          />
        )
      case 'requestPayment':
        return (
          <PaymentMessage
            attachTo={this.props.attachTo}
            message={this.props.message}
            onHidden={this.props.onHidden}
            position={this.props.position}
            visible={this.props.visible}
          />
        )
    }
    return null
  }
}

export default MessageAction
