// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Invites from './index'
import {invitesReclaim, invitesRefresh, notificationsSave, notificationsToggle} from '../../actions/settings'

import type {TypedState} from '../../constants/reducer'

class InvitationsContainer extends Component {
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
  }),
)(InvitationsContainer)
