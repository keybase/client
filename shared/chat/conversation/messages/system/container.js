// @flow
import * as Constants from '../../../../constants/chat'
import System from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getMessage = createCachedSelector(
  [Constants.getMessageFromMessageKey],
  (message: Constants.TextMessage) => message
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  return {
    message: getMessage(state, messageKey),
  }
}

export default compose(connect(mapStateToProps, () => ({})))(System)
