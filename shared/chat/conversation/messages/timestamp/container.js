// @flow
import * as Constants from '../../../../constants/chat'
import Timestamp from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux-profiled'
import {formatTimeForMessages} from '../../../../util/timestamp'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

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
