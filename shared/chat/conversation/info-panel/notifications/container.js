// @flow
import * as React from 'react'
import logger from '../../../../logger'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as ChatGen from '../../../../actions/chat-gen'
import {Notifications} from '.'
import {
  compose,
  connect,
  type TypedState,
  lifecycle,
  setDisplayName,
  type Dispatch,
} from '../../../../util/container'
import {type DeviceType} from '../../../../constants/types/devices'

type StateProps = {
  channelWide: boolean,
  desktop: Types.NotifyType,
  mobile: Types.NotifyType,
  muted: boolean,
  saveState: Types.NotificationSaveState,
}

type DispatchProps = {
  _resetSaveState: (conversationIDKey: Types.ConversationIDKey) => void,
  _onMuteConversation: (conversationIDKey: Types.ConversationIDKey, muted: boolean) => void,
  _onSetNotification: (
    conversationIDKey: Types.ConversationIDKey,
    deviceType: DeviceType,
    notifyType: Types.NotifyType
  ) => void,
  _onToggleChannelWide: (conversationIDKey: Types.ConversationIDKey) => void,
}

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
}

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

const mapStateToProps = (state: TypedState, {conversationIDKey}: OwnProps) => {
  const inbox = Constants.getSelectedInbox(state)
  // mapStateToPropsOnlyValid should filter this case (and the null
  // notifications case) out.
  if (!inbox) throw new Error('Impossible')
  const notifications = inbox.get('notifications')
  if (!notifications) throw new Error('Impossible')
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

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _resetSaveState: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(ChatGen.createSetNotificationSaveState({conversationIDKey, saveState: 'unsaved'}))
  },
  _onMuteConversation: (conversationIDKey: Types.ConversationIDKey, muted: boolean) => {
    dispatch(ChatGen.createMuteConversation({conversationIDKey, muted}))
  },
  _onSetNotification: (
    conversationIDKey: Types.ConversationIDKey,
    deviceType: DeviceType,
    notifyType: Types.NotifyType
  ) => {
    dispatch(ChatGen.createSetNotifications({conversationIDKey, deviceType, notifyType}))
  },
  _onToggleChannelWide: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(ChatGen.createToggleChannelWideNotifications({conversationIDKey}))
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  const convKey = ownProps.conversationIDKey
  return {
    _resetSaveState: () => dispatchProps._resetSaveState(convKey),
    channelWide: stateProps.channelWide,
    desktop: stateProps.desktop,
    mobile: stateProps.mobile,
    muted: stateProps.muted,
    saveState: stateProps.saveState,
    onMuteConversation: !Constants.isPendingConversationIDKey(convKey)
      ? (muted: boolean) => {
          dispatchProps._onMuteConversation(convKey, muted)
        }
      : null,
    onSetDesktop: (notifyType: Types.NotifyType) => {
      dispatchProps._onSetNotification(convKey, 'desktop', notifyType)
    },
    onSetMobile: (notifyType: Types.NotifyType) => {
      dispatchProps._onSetNotification(convKey, 'mobile', notifyType)
    },
    onToggleChannelWide: () => {
      dispatchProps._onToggleChannelWide(convKey)
    },
  }
}

const ConnectedNotifications = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('LifecycleNotifications'),
  lifecycle({
    componentDidMount() {
      this.props._resetSaveState()
    },
  })
)(Notifications)

const OnlyValidConversations = ({conversationIDKey}) =>
  conversationIDKey && <ConnectedNotifications conversationIDKey={conversationIDKey} />

const mapStateToPropsOnlyValid = (state: TypedState): * => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  if (!conversationIDKey) {
    return {conversationIDKey: null}
  }
  const inbox = Constants.getSelectedInbox(state)
  if (!inbox) {
    logger.warn('no selected inbox')
    return {conversationIDKey: null}
  }
  const notifications = inbox.get('notifications')
  if (!notifications) {
    logger.warn('no notifications')
    return {conversationIDKey: null}
  }
  return {conversationIDKey}
}

export default connect(mapStateToPropsOnlyValid)(OnlyValidConversations)
