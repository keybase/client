// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Invites from './index'
import {invitesReclaim, invitesRefresh, invitesSend, notificationsSave, notificationsToggle} from '../../actions/settings'

import type {TypedState} from '../../constants/reducer'
import type {Props} from './index'

type State = {
  email: string,
  message: string,
}

class InvitationsContainer extends Component<void, Props, State> {
  state: State;
  componentWillMount () {
    this.props.onRefresh()
  }

  render () {
    return <Invites {...this.props} />
  }
}

export default connect(
  (state: TypedState, ownProps: {}) => state.settings.invites,
  (dispatch: any, ownProps: {}) => ({
    onSave: () => dispatch(notificationsSave()),
    onToggle: (name: string) => dispatch(notificationsToggle(name)),
    onToggleUnsubscribeAll: () => dispatch(notificationsToggle()),
    onRefresh: () => dispatch(invitesRefresh()),
    onReclaimInvitation: (inviteId: string) => dispatch(invitesReclaim(inviteId)),
    onGenerateInvitation: (email: string, message: ?string) => dispatch(invitesSend(email, message)),
  }),
)(InvitationsContainer)
