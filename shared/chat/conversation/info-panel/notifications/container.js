// @flow
import * as React from 'react'
import logger from '../../../../logger'
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as ChatGen from '../../../../actions/chat-gen'
import {Notifications, type Props} from '.'
import {connect, type TypedState} from '../../../../util/container'
import {type DeviceType} from '../../../../constants/types/devices'

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

type OwnProps = {
  channelWide: boolean,
  conversationIDKey: string,
  desktop: Types.NotifyType,
  mobile: Types.NotifyType,
  muted: boolean,
  saveState: Types.NotificationSaveState,
}

type _Props = Props & {
  _resetSaveState: () => void,
}

const mergeProps = (_, dispatchProps: DispatchProps, ownProps: OwnProps): _Props => {
  const convKey = ownProps.conversationIDKey
  return {
    _resetSaveState: () => dispatchProps._resetSaveState(convKey),
    channelWide: ownProps.channelWide,
    desktop: ownProps.desktop,
    mobile: ownProps.mobile,
    muted: ownProps.muted,
    saveState: ownProps.saveState,
    onMuteConversation: (muted: boolean) => {
      dispatchProps._onMuteConversation(convKey, muted)
    },
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

class _NotificationsWithConvID extends React.PureComponent<_Props> {
  componentDidMount() {
    this.props._resetSaveState()
  }

  render() {
    return <Notifications {...this.props} />
  }
}

const NotificationsWithConvID = connect(() => ({}), mapDispatchToProps, mergeProps)(_NotificationsWithConvID)

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

// Use conversationIDKey as a signal for whether StateProps is empty.
type StateProps = OwnProps | {conversationIDKey: void}

const mapStateToProps = (state: TypedState): StateProps => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  if (!conversationIDKey) {
    logger.warn('no selected conversation')
    return {conversationIDKey: undefined}
  }
  const inbox = Constants.getSelectedInbox(state)
  if (!inbox) {
    logger.warn('no selected inbox')
    return {conversationIDKey: undefined}
  }
  const notifications = inbox.get('notifications')
  if (!notifications) {
    logger.warn('no notifications')
    return {conversationIDKey: undefined}
  }
  const desktop = serverStateToProps(notifications, 'desktop')
  const mobile = serverStateToProps(notifications, 'mobile')
  const muted = Constants.getMuted(state)
  const {channelWide} = notifications
  const saveState = inbox.get('notificationSaveState')

  return ({
    channelWide,
    conversationIDKey,
    desktop,
    mobile,
    muted,
    saveState,
  }: OwnProps)
}

class _MaybeNotifications extends React.PureComponent<StateProps> {
  render() {
    if (!this.props.conversationID) {
      return null
    }

    return <NotificationsWithConvID {...this.props} />
  }
}

export default connect(mapStateToProps, null, stateProps => stateProps)(_MaybeNotifications)
