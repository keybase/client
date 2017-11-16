// @flow
import * as Constants from '../../../../constants/chat'
import SystemNotice from '.'
import createCachedSelector from 're-reselect'
import {connect} from 'react-redux'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getDetails = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getYou, Constants.getFollowingMap],
  (message: Constants.SystemMessage, you: string, following: {[key: string]: ?boolean}) => ({
    following: !!following[message.author],
    message,
    you,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => getDetails(state, messageKey)

const mapDispatchToProps = () => ({})

export default connect(mapStateToProps, mapDispatchToProps)(SystemNotice)
