// @flow
import {WrapperTimestamp} from '../'
import * as Constants from '../../../../../constants/chat2/message'
import {setDisplayName, compose, connect, type TypedState} from '../../../../../util/container'
import {formatTimeForMessages} from '../../../../../util/timestamp'

const mapStateToProps = (state: TypedState, {message, previous}) => {
  const orangeLineOrdinal = state.chat2.orangeLineMap.get(message.conversationIDKey)
  const orangeLineAbove = !!previous && orangeLineOrdinal === previous.ordinal
  return {
    _message: message,
    messageID: message.id,
    orangeLineAbove,
    previous,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_message, messageID, previous} = stateProps

  const showTimestamp = Constants.enoughTimeBetweenMessages(_message, previous)

  const timestamp =
    stateProps.orangeLineAbove || !previous || showTimestamp
      ? formatTimeForMessages(_message.timestamp)
      : null

  return {
    children: ownProps.children,
    messageID,
    orangeLineAbove: stateProps.orangeLineAbove,
    timestamp,
  }
}

export default compose(connect(mapStateToProps, () => ({}), mergeProps), setDisplayName('WrapperTimestamp'))(
  WrapperTimestamp
)
