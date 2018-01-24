// @flow
import * as React from 'react'
import logger from '../../../../logger'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as ChatGen from '../../../../actions/chat-gen'
import {Notifications, type Props} from '.'
import {connect, type TypedState} from '../../../../util/container'
import {type DeviceType} from '../../../../constants/types/devices'

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

type StateProps = {
  // Set only when the state has a selected conversation, inbox, and
  // notifications object.
  _props?: {
    channelWide: boolean,
    conversationIDKey: string,
    desktop: Types.NotifyType,
    mobile: Types.NotifyType,
    muted: boolean,
    saveState: Types.NotificationSaveState,
  },
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
    _props: {
      channelWide,
      conversationIDKey,
      desktop,
      mobile,
      muted,
      saveState,
    },
  }
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

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _resetSaveState: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(ChatGen.createSetNotificationSaveState({conversationIDKey, saveState: 'unsaved'})),
  _onMuteConversation: (conversationIDKey: Types.ConversationIDKey, muted: boolean) => {
    dispatch(ChatGen.createMuteConversation({conversationIDKey, muted}))
  },
  _onSetNotification: (
    conversationIDKey: Types.ConversationIDKey,
    deviceType: DeviceType,
    notifyType: Types.NotifyType
  ) => dispatch(ChatGen.createSetNotifications({conversationIDKey, deviceType, notifyType})),
  _onToggleChannelWide: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(ChatGen.createToggleChannelWideNotifications({conversationIDKey})),
})

type _Props = {
  // Set only when stateProps has _props set.
  _props?: Props,
}

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps): _Props => {
  if (stateProps._props) {
    const props = stateProps._props
    return {
      _props: {
        channelWide: props.channelWide,
        desktop: props.desktop,
        mobile: props.mobile,
        muted: props.muted,
        resetSaveState: () => dispatchProps._resetSaveState(props.conversationIDKey),
        saveState: props.saveState,
        onMuteConversation: (muted: boolean) => {
          dispatchProps._onMuteConversation(props.conversationIDKey, muted)
        },
        onSetDesktop: (notifyType: Types.NotifyType) => {
          dispatchProps._onSetNotification(props.conversationIDKey, 'desktop', notifyType)
        },
        onSetMobile: (notifyType: Types.NotifyType) => {
          dispatchProps._onSetNotification(props.conversationIDKey, 'mobile', notifyType)
        },
        onToggleChannelWide: () => {
          dispatchProps._onToggleChannelWide(props.conversationIDKey)
        },
      },
    }
  } else {
    return {}
  }
}

class _Notifications extends React.PureComponent<_Props> {
  render() {
    if (!this.props._props) {
      return null
    }

    return <Notifications {...this.props._props} />
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(_Notifications)
