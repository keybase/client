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

  constructor (props: Props) {
    super(props)
    this.state = {
      email: this.props.inviteEmail,
      message: this.props.inviteMessage,
    }
  }

  componentWillMount () {
    this.props.onRefresh()
  }

  onGenerateInvitation () {
    const {email, message} = this.state
    console.log('in first onGenerateInvitation')
    console.log(email)
    console.log(message)
    this.props.onGenerateInvitation(email, message)
  }

  render () {
    return <Invites
      {...this.props}
      onChangeInviteEmail={email => this.setState({email})}
      onChangeInviteMessage={message => this.setState({message})}
      onGenerateInvitation={() => this.onGenerateInvitation()}
    />
  }
}

export default connect(
  (state: TypedState, ownProps: {}) => state.settings.invites,
  (dispatch: any, ownProps: {}) => ({
    onGenerateInvitation: (email: string, message: string) => dispatch(invitesSend(email, message)),
    onRefresh: () => dispatch(invitesRefresh()),
    onReclaimInvitation: (inviteId: string) => dispatch(invitesReclaim(inviteId)),
    onSave: () => dispatch(notificationsSave()),
    onToggle: (name: string) => dispatch(notificationsToggle(name)),
    onToggleUnsubscribeAll: () => dispatch(notificationsToggle()),
  }),
)(InvitationsContainer)
