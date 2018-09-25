// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {Notifications} from '.'
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  withStateHandlers,
  type TypedState,
} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
}

const mapStateToProps = (state: TypedState, {conversationIDKey}: OwnProps) => {
  const meta = Constants.getMeta(state, conversationIDKey)

  return {
    channelWide: meta.notificationsGlobalIgnoreMentions,
    conversationIDKey,
    desktop: meta.notificationsDesktop,
    mobile: meta.notificationsMobile,
    muted: meta.isMuted,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => ({
  _onMuteConversation: (muted: boolean) =>
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted})),
  _updateNotifications: (
    desktop: Types.NotificationsType,
    mobile: Types.NotificationsType,
    channelWide: boolean
  ) =>
    dispatch(
      Chat2Gen.createUpdateNotificationSettings({
        conversationIDKey,
        notificationsDesktop: desktop,
        notificationsGlobalIgnoreMentions: channelWide,
        notificationsMobile: mobile,
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  return {
    _muteConversation: (muted: boolean) => dispatchProps._onMuteConversation(muted),
    _storeChannelWide: stateProps.channelWide,
    _storeDesktop: stateProps.desktop,
    _storeMobile: stateProps.mobile,
    _storeMuted: stateProps.muted,
    _updateNotifications: (
      desktop: Types.NotificationsType,
      mobile: Types.NotificationsType,
      channelWide: boolean
    ) => dispatchProps._updateNotifications(desktop, mobile, channelWide),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('LifecycleNotifications'),
  withStateHandlers(
    props => ({
      channelWide: props._storeChannelWide,
      desktop: props._storeDesktop,
      mobile: props._storeMobile,
      muted: props._storeMuted,
      saving: false,
    }),
    {
      toggleChannelWide: (state, props) => () => {
        props._updateNotifications(state.desktop, state.mobile, !state.channelWide)
        return {channelWide: !state.channelWide}
      },
      toggleMuted: (state, props) => () => {
        props._muteConversation(!state.muted)
        return {muted: !state.muted}
      },
      updateDesktop: (state, props) => (desktop: Types.NotificationsType) => {
        if (desktop === state.desktop) {
          return
        }
        props._updateNotifications(desktop, state.mobile, state.channelWide)
        return {desktop}
      },
      updateMobile: (state, props) => (mobile: Types.NotificationsType) => {
        if (mobile === state.mobile) {
          return
        }
        props._updateNotifications(state.desktop, mobile, state.channelWide)
        return {mobile}
      },
      updateSaving: ({saving: oldSaving}) => (saving: boolean) => (oldSaving === saving ? null : {saving}),
      syncLocalToStore: (state, props) => (channelWide, desktop, mobile, muted) => ({
        channelWide,
        desktop,
        mobile,
        muted,
      }),
    }
  ),
  lifecycle({
    componentDidUpdate(prevProps) {
      // Same as the store and thought we were saving?
      if (
        this.props.saving &&
        this.props._storeDesktop === this.props.desktop &&
        this.props._storeMobile === this.props.mobile &&
        this.props._storeChannelWide === this.props.channelWide &&
        this.props._storeMuted === this.props.muted
      ) {
        this.props.updateSaving(false)
      } else {
        // did our local settings change at all?
        if (
          this.props.desktop !== prevProps.desktop ||
          this.props.mobile !== prevProps.mobile ||
          this.props.channelWide !== prevProps.channelWide ||
          this.props.muted !== prevProps.muted
        ) {
          this.props.updateSaving(true)
        }
      }
      // store changed?
      if (
        prevProps._storeDesktop !== this.props._storeDesktop ||
        prevProps._storeMobile !== this.props._storeMobile ||
        prevProps._storeChannelWide !== this.props._storeChannelWide ||
        prevProps._storeMuted !== this.props._storeMuted
      ) {
        this.props.syncLocalToStore(
          this.props._storeChannelWide,
          this.props._storeDesktop,
          this.props._storeMobile,
          this.props._storeMuted
        )
      }
    },
  })
)(Notifications)
