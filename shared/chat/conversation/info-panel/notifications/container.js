// @flow
import logger from '../../../../logger'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as ChatGen from '../../../../actions/chat-gen'
import Notifications from '.'
import {compose, branch, renderNothing, connect, lifecycle, type TypedState} from '../../../../util/container'
import {type DeviceType} from '../../../../constants/types/devices'

type StateProps =
  | {|
      channelWide: boolean,
      conversationIDKey: string,
      desktop: Types.NotifyType,
      mobile: Types.NotifyType,
      saveState: Types.NotificationSaveState,
    |}
  | {||}

type DispatchProps = {|
  _resetNotificationSaveState: (conversationIDKey: Types.ConversationIDKey) => void,
  onSetNotification: (
    conversationIDKey: Types.ConversationIDKey,
    deviceType: DeviceType,
    notifyType: Types.NotifyType
  ) => void,
  onToggleChannelWide: (conversationIDKey: Types.ConversationIDKey) => void,
|}

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

const mapStateToProps = (state: TypedState): StateProps => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  if (!conversationIDKey) {
    logger.warn('no selected conversation')
    return {}
  }
  const inbox = Constants.getSelectedInbox(state)
  if (!inbox) {
    logger.warn('no selected inbox')
    return {}
  }
  const notifications = inbox.get('notifications')
  if (!notifications) {
    logger.warn('no notifications')
    return {}
  }
  const desktop = serverStateToProps(notifications, 'desktop')
  const mobile = serverStateToProps(notifications, 'mobile')
  const muted = Constants.getMuted(state)
  const {channelWide} = notifications
  const saveState = inbox.get('notificationSaveState')

  return {
    channelWide,
    conversationIDKey,
    desktop,
    mobile,
    muted,
    saveState,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _resetNotificationSaveState: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(ChatGen.createSetNotificationSaveState({conversationIDKey, saveState: 'unsaved'})),
  _onMuteConversation: (conversationIDKey: Types.ConversationIDKey, muted: boolean) => {
    dispatch(ChatGen.createMuteConversation({conversationIDKey, muted}))
  },
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
      _resetNotificationSaveState: () => dispatchProps._resetNotificationSaveState(conversationIDKey),
      conversationIDKey: stateProps.conversationIDKey,
      channelWide: stateProps.channelWide,
      desktop: stateProps.desktop,
      mobile: stateProps.mobile,
      muted: stateProps.muted,
      saveState: stateProps.saveState,
      onMuteConversation: !Constants.isPendingConversationIDKey(conversationIDKey)
        ? (muted: boolean) => conversationIDKey && dispatchProps._onMuteConversation(conversationIDKey, muted)
        : null,
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
  // $FlowIssue temp
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._resetNotificationSaveState && this.props._resetNotificationSaveState()
    },
  }),
  branch(props => !props.conversationIDKey, renderNothing)
)(Notifications)
