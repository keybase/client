// @flow
import {WrapperTimestamp} from '.'
import {setDisplayName, compose, connect, type TypedState} from '../../../../util/container'
import {formatTimeForMessages} from '../../../../util/timestamp'

const howLongBetweenTimestampsMs = 1000 * 60 * 15

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

  const oldEnough = !!(
    previous &&
    previous.timestamp &&
    message.timestamp &&
    message.timestamp - previous.timestamp > howLongBetweenTimestampsMs
  )

  const timestamp =
    stateProps.orangeLineAbove || !previous || oldEnough ? formatTimeForMessages(message.timestamp) : null

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
