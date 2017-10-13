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
  [Constants.getChannelName],
  (message: Constants.TextMessage, channelname: string) => {
    console.warn('channelname is', channelname)
    return {
      channelname,
      message,
    }
  }
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => getMessage(state, messageKey)

const mergeProps = (stateProps) => {
  console.warn('stateProps are', stateProps)
  return stateProps
}
export default compose(connect(mapStateToProps, () => ({}), mergeProps))(System)
