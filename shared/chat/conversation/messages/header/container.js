// @flow
import * as Constants from '../../../../constants/chat'
import Header from '.'
import {compose} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  // $ForceType
  const conversationState: ?Constants.ConversationState = state.chat.getIn(['conversationStates', selectedConversationIDKey])

  const moreToLoad = conversationState && conversationState.get('moreToLoad')

  return {
    moreToLoad,
  }
}

export default compose(
  connect(mapStateToProps, () => ({})),
)(Header)
