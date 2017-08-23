// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import Notifications from '.'
import {connect} from 'react-redux'
import {CommonDeviceType} from '../../../../constants/types/flow-types'

import type {TypedState} from '../../../../constants/reducer'
import type {StateProps, DispatchProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  if (!conversationIDKey) {
    throw new Error('no selected conversation')
  }
  const inbox = Constants.getSelectedInbox(state)
  const notifications = inbox.get('notifications')
   
  return {
    conversationIDKey,
    desktop: notifications.desktop.generic ? 'generic' : (notifications.desktop.atmention ? 'atmention' : 'never'),
    mobile: notifications.mobile.generic ? 'generic' : (notifications.mobile.atmention ? 'atmention' : 'never')
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onSetDesktop: (conversationIDKey: Constants.ConversationIDKey, notify: NotifyType) =>
    dispatch(Creators.onSetDesktop(conversationIDKey, notify)),
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
