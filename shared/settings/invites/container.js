// @flow
import React, {Component} from 'react'
import Invites, {type Props, type PendingInvite} from '.'
import * as Constants from '../../constants/settings'
import {invitesReclaim, invitesRefresh, invitesSend} from '../../actions/settings'
import {showUserProfile} from '../../actions/profile'
import {navigateAppend} from '../../actions/route-tree'
import {connect, type TypedState} from '../../util/container'

// TODO recompose this
class InvitationsContainer extends Component<Props> {
  componentWillMount() {
    this.props.onRefresh()
  }

  render() {
    return <Invites {...this.props} />
  }
}

const mapStateToProps = (state: TypedState) => ({
  ...state.settings.invites,
  inviteEmail: '',
  inviteMessage: '',
  showMessageField: false,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClearError: () => dispatch({type: Constants.invitesClearError}),
  onGenerateInvitation: (email: string, message: string) => dispatch(invitesSend(email, message)),
  onReclaimInvitation: (inviteId: string) => dispatch(invitesReclaim(inviteId)),
  onRefresh: () => dispatch(invitesRefresh()),
  onSelectPendingInvite: (invite: PendingInvite) =>
    dispatch(navigateAppend([{props: {email: invite.email, link: invite.url}, selected: 'inviteSent'}])),
  onSelectUser: (username: string) => dispatch(showUserProfile(username)),
})

export default connect(mapStateToProps, mapDispatchToProps)(InvitationsContainer)
