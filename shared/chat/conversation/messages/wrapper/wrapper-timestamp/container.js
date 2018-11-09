// @flow
import * as React from 'react'
import {WrapperTimestamp} from '../'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import {namedConnect} from '../../../../../util/container'
import {formatTimeForMessages} from '../../../../../util/timestamp'

export type OwnProps = {|
  children?: React.Node,
  isEditing: boolean,
  measure: null | (() => void),
  message: Types.Message,
  previous: ?Types.Message,
|}

const shouldDecorateMessage = (message: Types.Message, you: string) => {
  if (
    (message.type === 'text' || message.type === 'attachment') &&
    (message.exploded || message.errorReason)
  ) {
    return false
  }
  if (message.type === 'systemJoined') {
    // special case. "You joined #<channel>" messages render with a blue user notice so don't decorate those
    return message.author !== you
  }
  return Constants.decoratedMessageTypes.includes(message.type)
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const messageIDWithOrangeLine = state.chat2.orangeLineMap.get(ownProps.message.conversationIDKey)
  return {
    _you: state.config.username || '',
    conversationIDKey: ownProps.message.conversationIDKey,
    orangeLineAbove: messageIDWithOrangeLine === ownProps.message.id,
    ordinal: ownProps.message.ordinal,
    previous: ownProps.previous,
    shouldShowPopup: Constants.shouldShowPopup(state, ownProps.message),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {ordinal, previous} = stateProps
  const {message} = ownProps

  // Placeholder messages can be !previous but have a zero-timestamp, so we can't
  // try to show a timestamp for them.
  const showTimestamp =
    Constants.enoughTimeBetweenMessages(message, previous) || (message.timestamp && !previous)

  const timestamp = showTimestamp ? formatTimeForMessages(message.timestamp) : ''

  const sequentialUserMessages =
    previous &&
    previous.author === message.author &&
    Constants.authorIsCollapsible(message) &&
    Constants.authorIsCollapsible(previous)
  const isShowingUsername = !previous || !sequentialUserMessages || !!timestamp

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
    isShowingUsername,
    measure: ownProps.measure,
    message: message,
    orangeLineAbove: stateProps.orangeLineAbove,
    ordinal,
    previous: ownProps.previous,
    shouldShowPopup: stateProps.shouldShowPopup,
    timestamp,
    type,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps,
  'WrapperTimestamp'
)(WrapperTimestamp)
