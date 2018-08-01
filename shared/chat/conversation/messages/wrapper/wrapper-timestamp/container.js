// @flow
import * as React from 'react'
import WrapperTimestamp from '.'
import * as MessageConstants from '../../../../../constants/chat2/message'
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

const decoratedMessageTypes: Array<Types.MessageType> = ['attachment', 'text', 'systemLeft']
const shouldDecorateMessage = (message: Types.Message, you: string) => {
  if ((message.type === 'text' || message.type === 'attachment') && message.exploded) {
    return false
  }
  if (decoratedMessageTypes.includes(message.type)) {
    return true
  } else if (message.type === 'systemJoined') {
    // special case. "You joined #<channel>" messages render with a blue user notice so don't decorate those
    return message.author !== you
  }
  return false
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const lastReadMessageID = state.chat2.lastReadMessageMap.get(ownProps.message.conversationIDKey)
  // Show the orange line on the first message after the last read message
  // Messages sent sent by you don't count
  const orangeLineAbove =
    !!ownProps.previous &&
    lastReadMessageID === ownProps.previous.id &&
    ownProps.message.author !== state.config.username

  return {
    _you: state.config.username || '',
    conversationIDKey: ownProps.message.conversationIDKey,
    orangeLineAbove,
    ordinal: ownProps.message.ordinal,
    previous: ownProps.previous,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {ordinal, previous} = stateProps
  const {message} = ownProps

  const showTimestamp = MessageConstants.enoughTimeBetweenMessages(message, previous)

  const timestamp =
    stateProps.orangeLineAbove || !previous || showTimestamp ? formatTimeForMessages(message.timestamp) : null

  let type = 'children'
  if (['text', 'attachment'].includes(ownProps.message.type)) {
    type = 'wrapper-author'
  }

  const decorate = shouldDecorateMessage(message, stateProps._you)

  return {
    children: ownProps.children,
    conversationIDKey: stateProps.conversationIDKey,
    decorate,
    exploded: (message.type === 'attachment' || message.type === 'text') && message.exploded,
    isEditing: ownProps.isEditing,
    measure: ownProps.measure,
    message: message,
    orangeLineAbove: stateProps.orangeLineAbove,
    ordinal,
    previous: ownProps.previous,
    timestamp,
    type,
  }
}

export default compose(connect(mapStateToProps, () => ({}), mergeProps), setDisplayName('WrapperTimestamp'))(
  WrapperTimestamp
)
