import * as Constants from '../../constants/settings'
import * as SettingsGen from '../../actions/settings-gen'
import type * as Types from '../../constants/types/settings'
import Invites from '.'
import {createShowUserProfile} from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

type OwnProps = {}

export default Container.connect(
  state => ({
    acceptedInvites: state.settings.invites.acceptedInvites,
    error: state.settings.invites.error,
    inviteEmail: '',
    inviteMessage: '',
    pendingInvites: state.settings.invites.pendingInvites,
    showMessageField: false,
    waitingForResponse: Container.anyWaiting(state, Constants.settingsWaitingKey),
  }),
  dispatch => ({
    onClearError: () => dispatch(SettingsGen.createInvitesClearError()),
    onGenerateInvitation: (email: string, message: string) =>
      dispatch(SettingsGen.createInvitesSend({email, message})),
    onReclaimInvitation: (inviteId: string) => dispatch(SettingsGen.createInvitesReclaim({inviteId})),
    onRefresh: () => dispatch(SettingsGen.createInvitesRefresh()),
    onSelectPendingInvite: (invite: Types.PendingInvite) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {email: invite.email, link: invite.url}, selected: 'inviteSent'}],
        })
      ),
    onSelectUser: (username: string) => dispatch(createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    acceptedInvites: stateProps.acceptedInvites,
    error: stateProps.error,
    inviteEmail: stateProps.inviteEmail,
    inviteMessage: stateProps.inviteMessage,
    onClearError: dispatchProps.onClearError,
    onGenerateInvitation: dispatchProps.onGenerateInvitation,
    onReclaimInvitation: dispatchProps.onReclaimInvitation,
    onRefresh: dispatchProps.onRefresh,
    onSelectPendingInvite: dispatchProps.onSelectPendingInvite,
    onSelectUser: dispatchProps.onSelectUser,
    pendingInvites: stateProps.pendingInvites,
    showMessageField: stateProps.showMessageField,
    waitingForResponse: stateProps.waitingForResponse,
  })
)(Invites)
