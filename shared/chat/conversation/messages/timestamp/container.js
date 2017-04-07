// @flow
import * as Constants from '../../../../constants/chat'
import Timestamp from '.'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {formatTimeForMessages} from '../../../../util/timestamp'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  // $ForceType
  const message: Constants.TimestampMessage = state.chat.getIn(['messageMap', messageKey])
  const timestamp = formatTimeForMessages(message.timestamp)
  // console.log('aaa', timestamp, message)

  return {
    timestamp,
  }
}

export default compose(
  connect(mapStateToProps, () => ({})),
)(Timestamp)
