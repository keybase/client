// @flow
import * as Constants from '../../../../constants/chat'
import Timestamp from '.'
import createCachedSelector from 're-reselect'
import {compose, connect, type TypedState} from '../../../../util/container'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {type OwnProps} from './container'

const getTimestampString = createCachedSelector(
  [Constants.getMessageFromMessageKey],
  (message: Constants.TimestampMessage) => formatTimeForMessages(message.timestamp)
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  return {
    timestamp: getTimestampString(state, messageKey),
  }
}

export default compose(connect(mapStateToProps, () => ({})))(Timestamp)
