// @flow
import {WrapperTimestamp} from '../'
import * as Constants from '../../../../../constants/chat2/message'
import {setDisplayName, compose, connect, type TypedState} from '../../../../../util/container'
import {formatTimeForMessages} from '../../../../../util/timestamp'

const mapStateToProps = (state: TypedState, {message, previous}) => {
  const orangeLineOrdinal = state.chat2.orangeLineMap.get(message.conversationIDKey)
  const orangeLineAbove = !!previous && orangeLineOrdinal === previous.ordinal
  return {
    message,
    orangeLineAbove,
    previous,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {message, previous} = stateProps

  const showTimestamp = Constants.enoughTimeBetweenMessages(message, previous)

  const timestamp =
    stateProps.orangeLineAbove || !previous || showTimestamp ? formatTimeForMessages(message.timestamp) : null

  return {
    children: ownProps.children,
    message,
    orangeLineAbove: stateProps.orangeLineAbove,
    timestamp,
  }
}

export default compose(connect(mapStateToProps, () => ({}), mergeProps), setDisplayName('WrapperTimestamp'))(
  WrapperTimestamp
)
