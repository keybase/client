// @flow
import {WrapperTimestamp} from '../'
import * as Constants from '../../../../../constants/chat2/message'
import * as Types from '../../../../../constants/types/chat2'
import {setDisplayName, compose, connect, type TypedState} from '../../../../../util/container'
import {formatTimeForMessages} from '../../../../../util/timestamp'

const mapStateToProps = (
  state: TypedState,
  props: {
    message: Types.Message,
    previous: ?Types.Message,
  }
) => {
  const lastReadMessageID = state.chat2.lastReadMessageMap.get(props.message.conversationIDKey)
  // Show the orange line on the first message after the last unread message
  // Messages sent sent by you don't count
  const orangeLineAbove =
    !!props.previous &&
    lastReadMessageID === props.previous.id &&
    props.message.author !== state.config.username

  return {
    _message: props.message,
    conversationIDKey: props.message.conversationIDKey,
    orangeLineAbove,
    ordinal: props.message.ordinal,
    previous: props.previous,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_message, ordinal, previous} = stateProps

  const showTimestamp = Constants.enoughTimeBetweenMessages(_message, previous)

  const timestamp =
    stateProps.orangeLineAbove || !previous || showTimestamp
      ? formatTimeForMessages(_message.timestamp)
      : null

  return {
    children: ownProps.children,
    conversationIDKey: stateProps.conversationIDKey,
    orangeLineAbove: stateProps.orangeLineAbove,
    ordinal,
    timestamp,
  }
}

export default compose(connect(mapStateToProps, () => ({}), mergeProps), setDisplayName('WrapperTimestamp'))(
  WrapperTimestamp
)
