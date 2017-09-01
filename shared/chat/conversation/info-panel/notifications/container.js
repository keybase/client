// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import Notifications from '.'
import {connect} from 'react-redux'

import type {DeviceType} from '../../../../constants/types/more'
import type {TypedState} from '../../../../constants/reducer'
import type {StateProps, DispatchProps} from './container'

const serverStateToProps = (notifications: Constants.NotificationsState, type: 'desktop' | 'mobile') => {
  // The server state has independent bool values for atmention/generic,
  // but the design has three radio buttons -- atmention, generic, never.
  // So:
  //  - generic: true,  atmention: true  = generic
  //  - generic: false, atmention: true  = atmention
  //  - generic: true,  atmention: false = generic
  //  - generic: false, atmention: false = never
  if (notifications[type] && notifications[type].generic) {
    return 'generic'
  }
  if (notifications[type] && notifications[type].atmention) {
    return 'atmention'
  }
  return 'never'
}

const mapStateToProps = (state: TypedState) => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  if (!conversationIDKey) {
    throw new Error('no selected conversation')
  }
  const inbox = Constants.getSelectedInbox(state)
  const notifications = inbox.get('notifications')
  const desktop = serverStateToProps(notifications, 'desktop')
  const mobile = serverStateToProps(notifications, 'mobile')
  const {channelWide} = notifications

  return {
    channelWide,
    conversationIDKey,
    desktop,
    mobile,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onSetNotification: (
    conversationIDKey: Constants.ConversationIDKey,
    deviceType: DeviceType,
    notifyType: Constants.NotifyType
  ) => dispatch(Creators.setNotifications(conversationIDKey, deviceType, notifyType)),
  onToggleChannelWide: (conversationIDKey: Constants.ConversationIDKey) =>
    dispatch(Creators.toggleChannelWideNotifications(conversationIDKey)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  channelWide: stateProps.channelWide,
  desktop: stateProps.desktop,
  mobile: stateProps.mobile,
  onSetDesktop: (notifyType: Constants.NotifyType) => {
    dispatchProps.onSetNotification(stateProps.conversationIDKey, 'desktop', notifyType)
  },
  onSetMobile: (notifyType: Constants.NotifyType) => {
    dispatchProps.onSetNotification(stateProps.conversationIDKey, 'mobile', notifyType)
  },
  onToggleChannelWide: () => {
    dispatchProps.onToggleChannelWide(stateProps.conversationIDKey)
  },
})

// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Notifications)
