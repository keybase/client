import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import {StylesCrossPlatform} from '../../../../../styles'
import ExplodingMeta, {_Props as ViewProps} from '.'

const emptyProps = {
  exploded: true,
  explodesAt: 0,
  exploding: false,
  messageKey: '',
  pending: false,
}

export type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  onClick?: () => void
  ordinal: Types.Ordinal
  style?: StylesCrossPlatform
}
const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
  if (!message || (message.type !== 'text' && message.type !== 'attachment') || !message.exploding) {
    return emptyProps
  }
  return {
    exploded: message.exploded,
    explodesAt: message.explodingTime,
    exploding: message.exploding,
    messageKey: Constants.getMessageKey(message),
    pending: !!message.submitState && ['pending', 'failed'].includes(message.submitState),
  }
}

type WrapperProps = {exploding: boolean} & ViewProps

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

const Connected = Container.namedConnect(
  mapStateToProps,
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    exploded: stateProps.exploded,
    explodesAt: stateProps.explodesAt,
    exploding: stateProps.exploding,
    messageKey: stateProps.messageKey,
    onClick: ownProps.onClick,
    pending: stateProps.pending,
    style: ownProps.style,
  }),
  'ExplodingMeta'
)(Wrapper)
export default Connected
