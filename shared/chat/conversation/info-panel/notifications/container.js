// @flow
import logger from '../../../../logger'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as ChatGen from '../../../../actions/chat-gen'
import {Notifications, type Props} from '.'
import {connect, type TypedState} from '../../../../util/container'
import {type DeviceType} from '../../../../constants/types/devices'

type StateProps = {
  props?: {
    channelWide: boolean,
    conversationIDKey: string,
    desktop: Types.NotifyType,
    mobile: Types.NotifyType,
    muted: boolean,
    saveState: Types.NotificationSaveState,
  },
}

type DispatchProps = {|
  _resetSaveState: (conversationIDKey: Types.ConversationIDKey) => void,
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
    props: {
      channelWide,
      conversationIDKey,
      desktop,
      mobile,
      muted,
      saveState,
    },
  }
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _resetSaveState: (conversationIDKey: Types.ConversationIDKey) =>
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

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps): Props => {
  if (stateProps.props) {
    const props = stateProps.props
    return {
      hasConversation: true,
      channelWide: props.channelWide,
      desktop: props.desktop,
      mobile: props.mobile,
      muted: props.muted,
      resetSaveState: () => dispatchProps._resetSaveState(props.conversationIDKey),
      saveState: props.saveState,
      onSetDesktop: (notifyType: Types.NotifyType) => {
        dispatchProps.onSetNotification(props.conversationIDKey, 'desktop', notifyType)
      },
      onSetMobile: (notifyType: Types.NotifyType) => {
        dispatchProps.onSetNotification(props.conversationIDKey, 'mobile', notifyType)
      },
      onToggleChannelWide: () => {
        dispatchProps.onToggleChannelWide(props.conversationIDKey)
      },
    }
  } else {
    return {
      hasConversation: false,
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Notifications)
