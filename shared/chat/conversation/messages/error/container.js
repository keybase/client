// @flow
import * as Constants from '../../../../constants/chat'
import Error from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getReason = createCachedSelector(
  [Constants.getMessageFromMessageKey],
  (message: Constants.ErrorMessage) => message.reason
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  return {
    reason: getReason(state, messageKey),
  }
}

export default compose(connect(mapStateToProps, () => ({})))(Error)
