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
    conversationIDKey: message.conversationIDKey,
    orangeLineAbove,
    ordinal: message.ordinal,
    previous,
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
