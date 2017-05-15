// @flow
import React, {Component} from 'react'
import Invites from './index'
import {
  invitesReclaim,
  invitesRefresh,
  invitesSend,
  notificationsSave,
  notificationsToggle,
} from '../../actions/settings'
import {openURLWithHelper} from '../../util/open-url'

import {navigateAppend} from '../../actions/route-tree'

import type {Props, PendingInvite} from './index'
import {TypedConnector} from '../../util/typed-connect'
import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'

class InvitationsContainer extends Component<void, Props, void> {
  componentWillMount() {
    this.props.onRefresh()
  }

  render() {
    return <Invites {...this.props} />
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

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
    onSave: () => {
      dispatch(notificationsSave())
    },
    onToggle: (name: string) => dispatch(notificationsToggle(name)),
    onToggleUnsubscribeAll: () => dispatch(notificationsToggle()),
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
