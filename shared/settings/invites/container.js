// @flow
import React, {Component} from 'react'
import Invites from './index'
import {invitesReclaim, invitesRefresh, invitesSend} from '../../actions/settings'
import {openURLWithHelper} from '../../util/open-url'

import {navigateAppend} from '../../actions/route-tree'

import type {Props, PendingInvite} from './index'
import {TypedConnector} from '../../util/typed-connect'

class InvitationsContainer extends Component<Props> {
  componentWillMount() {
    this.props.onRefresh()
  }

  render() {
    return <Invites {...this.props} />
  }
}

const connector = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => {
  return {
    ...state.settings.invites,
    inviteEmail: '',
    inviteMessage: '',
    showMessageField: false,
    waitingForResponse: state.settings.waitingForResponse,
    onGenerateInvitation: (email: string, message: string) => {
      dispatch(invitesSend(email, message))
    },
    onClearError: () => {
      dispatch({type: 'invites:clearError'})
    },
    onRefresh: () => {
      dispatch(invitesRefresh())
    },
    onReclaimInvitation: (inviteId: string) => {
      dispatch(invitesReclaim(inviteId))
    },
    onSelectUser: (username: string) => {
      openURLWithHelper('user', {username})
    },
    onSelectPendingInvite: (invite: PendingInvite) => {
      dispatch(
        navigateAppend([
          {
            selected: 'inviteSent',
            props: {
              email: invite.email,
              link: invite.url,
            },
          },
        ])
      )
    },
  }
})(InvitationsContainer)
