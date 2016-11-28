// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Invites from './index'
import {invitesReclaim, invitesRefresh, invitesSend, notificationsSave, notificationsToggle} from '../../actions/settings'

import type {Props} from './index'
import type {TypedState} from '../../constants/reducer'

export type RouteState = {
  email: string,
  message: string,
}

class InvitationsContainer extends Component<void, Props, void> {
  componentWillMount () {
    this.props.onRefresh()
  }

  render () {
    return <Invites
      {...this.props}
      showMessageField={!!this.props.inviteEmail}
    />
  }
}

export default connect(
  (state: TypedState, {routeState}) => ({
    ...state.settings.invites,
    inviteEmail: routeState.inviteEmail,
    inviteMessage: routeState.inviteMessage,
    waitingForResponse: state.settings.waitingForResponse,
  }),
  (dispatch: any, {routeState, setRouteState}) => ({
    onChangeInviteEmail: inviteEmail => { setRouteState({inviteEmail}) },
    onChangeInviteMessage: inviteMessage => { setRouteState({inviteMessage}) },
    onGenerateInvitation: (email: string, message: string) => dispatch(invitesSend(routeState.email, routeState.message)),
    onRefresh: () => dispatch(invitesRefresh()),
    onReclaimInvitation: (inviteId: string) => dispatch(invitesReclaim(inviteId)),
    onSave: () => dispatch(notificationsSave()),
    onToggle: (name: string) => dispatch(notificationsToggle(name)),
    onToggleUnsubscribeAll: () => dispatch(notificationsToggle()),
  }),
)(InvitationsContainer)
