// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import {type StylesCrossPlatform} from '../../../../../styles'
import ExplodingMeta, {type _Props as ViewProps} from '.'

const emptyProps = {
  exploded: true,
  explodesAt: 0,
  exploding: false,
  messageKey: '',
  pending: false,
}

export type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  onClick: ?() => void,
  ordinal: Types.Ordinal,
  style?: StylesCrossPlatform,
|}
const mapStateToProps = (state, ownProps: OwnProps) => {
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
  if (!message || (message.type !== 'text' && message.type !== 'attachment') || !message.exploding) {
    return emptyProps
  }
  return {
    exploded: message.exploded,
    explodesAt: message.explodingTime,
    exploding: message.exploding,
    messageKey: Constants.getMessageKey(message),
    pending: ['pending', 'failed'].includes(message.submitState),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  exploded: stateProps.exploded,
  explodesAt: stateProps.explodesAt,
  exploding: stateProps.exploding,
  messageKey: stateProps.messageKey,
  onClick: ownProps.onClick,
  pending: stateProps.pending,
  style: ownProps.style,
})

type WrapperProps = {|
  ...ViewProps,
  exploding: boolean,
|}
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

const Connected = Container.compose(
  Container.connect(mapStateToProps, () => ({}), mergeProps),
  Container.setDisplayName('ExplodingMeta')
)(Wrapper)
export default Connected
