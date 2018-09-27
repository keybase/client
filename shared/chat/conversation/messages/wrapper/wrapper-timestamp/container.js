// @flow
import * as React from 'react'
import {WrapperTimestamp} from '../'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import {setDisplayName, compose, connect, type TypedState} from '../../../../../util/container'
import {formatTimeForMessages} from '../../../../../util/timestamp'

export type OwnProps = {|
  children?: React.Node,
  isEditing: boolean,
  measure: null | (() => void),
  message: Types.Message,
  previous: ?Types.Message,
|}

const shouldDecorateMessage = (message: Types.Message, you: string) => {
  if ((message.type === 'text' || message.type === 'attachment') && message.exploded) {
    return false
  }
  if (message.type === 'systemJoined') {
    // special case. "You joined #<channel>" messages render with a blue user notice so don't decorate those
    return message.author !== you
  }
  return Constants.decoratedMessageTypes.includes(message.type)
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const messageIDWithOrangeLine = state.chat2.orangeLineMap.get(ownProps.message.conversationIDKey)
  return {
    _you: state.config.username || '',
    conversationIDKey: ownProps.message.conversationIDKey,
    orangeLineAbove: messageIDWithOrangeLine === ownProps.message.id,
    ordinal: ownProps.message.ordinal,
    previous: ownProps.previous,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {ordinal, previous} = stateProps
  const {message} = ownProps

  // Placeholder messages can pass this test ("orangeLineAbove || !previous")
  // but have a zero-timestamp, so we can't try to show a timestamp for them.
  const showTimestamp =
    Constants.enoughTimeBetweenMessages(message, previous) ||
    (message.timestamp && (stateProps.orangeLineAbove || !previous))

  const timestamp = showTimestamp ? formatTimeForMessages(message.timestamp) : ''

  let type = 'children'
  if (Constants.showAuthorMessageTypes.includes(ownProps.message.type)) {
    type = 'wrapper-author'
  }

  const decorate = shouldDecorateMessage(message, stateProps._you)

  return {
    children: ownProps.children,
    conversationIDKey: stateProps.conversationIDKey,
    decorate,
    exploded: (message.type === 'attachment' || message.type === 'text') && message.exploded,
    isEditing: ownProps.isEditing,
    isRevoked: (message.type === 'text' || message.type === 'attachment') && !!message.deviceRevokedAt,
    measure: ownProps.measure,
    message: message,
    orangeLineAbove: stateProps.orangeLineAbove,
    ordinal,
    previous: ownProps.previous,
    timestamp,
    type,
  }
}

export default compose(
  connect(
    mapStateToProps,
    () => ({}),
    mergeProps
  ),
  setDisplayName('WrapperTimestamp')
)(WrapperTimestamp)
