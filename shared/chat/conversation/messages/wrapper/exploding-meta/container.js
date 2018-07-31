// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import {type StylesCrossPlatform} from '../../../../../styles'
import ExplodingMeta, {type _Props as ViewProps} from '.'

const emptyProps = {
  exploding: false,
  exploded: true,
  explodesAt: 0,
  messageKey: '',
  pending: false,
}

export type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  onClick: () => void,
  ordinal: Types.Ordinal,
  style?: StylesCrossPlatform,
|}
const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
  if (!message || (message.type !== 'text' && message.type !== 'attachment') || !message.exploding) {
    return emptyProps
  }
  return {
    exploding: message.exploding,
    exploded: message.exploded,
    explodesAt: message.explodingTime,
    messageKey: Constants.getMessageKey(message),
    pending: ['pending', 'failed'].includes(message.submitState),
  }
}

type WrapperProps = {
  ...ViewProps,
  exploding: boolean,
}
const Wrapper = (props: WrapperProps) =>
  !props.exploding ? null : (
    <ExplodingMeta
      exploded={props.exploded}
      explodesAt={props.explodesAt}
      messageKey={props.messageKey}
      onClick={props.onClick}
      pending={props.pending}
      style={props.style}
    />
  )

export default Container.compose(
  Container.connect(mapStateToProps),
  Container.setDisplayName('ExplodingMeta')
)(Wrapper)
