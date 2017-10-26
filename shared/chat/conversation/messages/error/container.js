// @flow
import * as Constants from '../../../../constants/chat'
import Error from '.'
import createCachedSelector from 're-reselect'
import {compose, connect, type TypedState} from '../../../../util/container'
import {type OwnProps} from './container'

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
