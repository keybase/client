import * as Constants from '../../constants/settings'
import * as SettingsGen from '../../actions/settings-gen'
import * as Types from '../../constants/types/settings'
import Invites from '.'
import {createShowUserProfile} from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

type OwnProps = {}
const mapStateToProps = state => ({
  acceptedInvites: state.settings.invites.acceptedInvites,
  error: state.settings.invites.error,
  inviteEmail: '',
  inviteMessage: '',
  pendingInvites: state.settings.invites.pendingInvites,
  showMessageField: false,
  waitingForResponse: Container.anyWaiting(state, Constants.settingsWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  onClearError: () => dispatch(SettingsGen.createInvitesClearError()),
  onGenerateInvitation: (email: string, message: string) =>
    dispatch(SettingsGen.createInvitesSend({email, message})),
  onReclaimInvitation: (inviteId: string) => dispatch(SettingsGen.createInvitesReclaim({inviteId})),
  onRefresh: () => dispatch(SettingsGen.createInvitesRefresh()),
  onSelectPendingInvite: (invite: Types.Invitation) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {email: invite.email, link: invite.url}, selected: 'inviteSent'}],
      })
    ),
  onSelectUser: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...ownProps,
  ...stateProps,
  ...dispatchProps,
  acceptedInvites: stateProps.acceptedInvites.toArray(),
  pendingInvites: stateProps.pendingInvites.toArray(),
})

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.lifecycle({
    componentDidMount() {
      // @ts-ignore NO recompose
      this.props.onRefresh()
    },
  })
)(Invites)
