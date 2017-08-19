// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import Notifications from '.'
import {connect} from 'react-redux'

import type {TypedState} from '../../../../constants/reducer'
import type {StateProps, DispatchProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  if (!conversationIDKey) {
    throw new Error('no selected conversation')
  }

  return {
    conversationIDKey,
    desktop: 'atmention',
    mobile: 'atmention',
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenConversation: (conversationIDKey: Constants.ConversationIDKey) =>
    dispatch(Creators.openConversation(conversationIDKey)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  onSetDesktop: () => {
    dispatchProps.onOpenConversation(stateProps.conversationIDKey)
  },
  onSetMobile: () => {
    dispatchProps.onOpenConversation(stateProps.conversationIDKey)
  },
  desktop: stateProps.desktop,
  mobile: stateProps.mobile,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Notifications)
