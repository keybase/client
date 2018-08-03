// @flow
import {WrapperTimestamp} from '../'
import * as Constants from '../../../../../constants/chat2/message'
import * as Types from '../../../../../constants/types/chat2'
import {setDisplayName, compose, connect, type TypedState} from '../../../../../util/container'
import {formatTimeForMessages} from '../../../../../util/timestamp'

type OwnProps = {
  message: Types.Message,
  previous: ?Types.Message,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const lastReadMessageID = state.chat2.orangeLineMap.get(ownProps.message.conversationIDKey)
  // Show the orange line on the first message after the last read message
  const orangeLineAbove = !!ownProps.previous && lastReadMessageID === ownProps.previous.id

  return {
    _message: ownProps.message,
    conversationIDKey: ownProps.message.conversationIDKey,
    orangeLineAbove,
    ordinal: ownProps.message.ordinal,
    previous: ownProps.previous,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_message, ordinal, previous} = stateProps

  // Placeholder messages can pass this test ("orangeLineAbove || !previous")
  // but have a zero-timestamp, so we can't try to show a timestamp for them.
  const showTimestamp =
    Constants.enoughTimeBetweenMessages(_message, previous) ||
    (_message.timestamp && (stateProps.orangeLineAbove || !previous))

  const timestamp = showTimestamp ? formatTimeForMessages(_message.timestamp) : null

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
