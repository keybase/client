// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {Notifications, type SaveStateType} from '.'
import {
  compose,
  connect,
  lifecycle,
  setDisplayName,
  withStateHandlers,
  type TypedState,
  type Dispatch,
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

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}: OwnProps) => ({
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
      saveState: 'same',
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
          return {}
        }
        props._updateNotifications(desktop, state.mobile, state.channelWide)
        return {desktop}
      },
      updateMobile: (state, props) => (mobile: Types.NotificationsType) => {
        if (mobile === state.mobile) {
          return {}
        }
        props._updateNotifications(state.desktop, mobile, state.channelWide)
        return {mobile}
      },
      updateSaveState: () => (saveState: SaveStateType) => ({saveState}),
      syncLocalToStore: (state, props) => (channelWide, desktop, mobile, muted) => ({
        channelWide,
        desktop,
        mobile,
        muted,
      }),
    }
  ),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      // Same as the store?
      if (
        nextProps._storeDesktop === nextProps.desktop &&
        nextProps._storeMobile === nextProps.mobile &&
        nextProps._storeChannelWide === nextProps.channelWide &&
        nextProps._storeMuted === nextProps.muted
      ) {
        // Mark it as saved
        if (nextProps.saveState === 'saving') {
          nextProps.updateSaveState('justSaved')
          setTimeout(() => {
            nextProps.updateSaveState('same')
          }, 2500)
        }
      } else {
        // did our local settings change at all?
        if (
          this.props.desktop !== nextProps.desktop ||
          this.props.mobile !== nextProps.mobile ||
          this.props.channelWide !== nextProps.channelWide ||
          this.props.muted !== nextProps.muted
        ) {
          if (nextProps.saveState !== 'saving') {
            nextProps.updateSaveState('saving')
          }
        }
      }
      // store changed?
      if (
        this.props._storeDesktop !== nextProps._storeDesktop ||
        this.props._storeMobile !== nextProps._storeMobile ||
        this.props._storeChannelWide !== nextProps._storeChannelWide ||
        this.props._storeMuted !== nextProps._storeMuted
      ) {
        nextProps.syncLocalToStore(
          nextProps._storeChannelWide,
          nextProps._storeDesktop,
          nextProps._storeMobile,
          nextProps._storeMuted
        )
      }
    },
  })
)(Notifications)
