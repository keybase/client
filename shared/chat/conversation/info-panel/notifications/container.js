// @flow
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as ChatGen from '../../../../actions/chat-gen'
import Notifications from '.'
import {compose, branch, renderNothing, connect, type TypedState} from '../../../../util/container'
import {type DeviceType} from '../../../../constants/types/devices'
import {type StateProps, type DispatchProps} from './container'

const serverStateToProps = (notifications: Types.NotificationsState, type: 'desktop' | 'mobile') => {
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
    console.warn('no selected conversation')
    return {}
  }
  const inbox = Constants.getSelectedInbox(state)
  if (!inbox) {
    console.warn('no selected inbox')
    return {}
  }
  const notifications = inbox.get('notifications')
  if (!notifications) {
    console.warn('no notifications')
    return {}
  }
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
    conversationIDKey: Types.ConversationIDKey,
    deviceType: DeviceType,
    notifyType: Types.NotifyType
  ) => dispatch(ChatGen.createSetNotifications({conversationIDKey, deviceType, notifyType})),
  onToggleChannelWide: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(ChatGen.createToggleChannelWideNotifications({conversationIDKey})),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  if (stateProps.conversationIDKey) {
    const {conversationIDKey} = stateProps
    return {
      conversationIDKey: stateProps.conversationIDKey,
      channelWide: stateProps.channelWide,
      desktop: stateProps.desktop,
      mobile: stateProps.mobile,
      onSetDesktop: (notifyType: Types.NotifyType) => {
        dispatchProps.onSetNotification(conversationIDKey, 'desktop', notifyType)
      },
      onSetMobile: (notifyType: Types.NotifyType) => {
        dispatchProps.onSetNotification(conversationIDKey, 'mobile', notifyType)
      },
      onToggleChannelWide: () => {
        dispatchProps.onToggleChannelWide(conversationIDKey)
      },
    }
  } else {
    return {}
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => !props.conversationIDKey, renderNothing)
)(Notifications)
