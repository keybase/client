// @flow
import * as SettingsGen from '../../actions/settings-gen'
import Invites, {type PendingInvite} from '.'
import {createShowUserProfile} from '../../actions/profile-gen'
import {navigateAppend} from '../../actions/route-tree'
import {connect, type TypedState, lifecycle, compose} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({
  ...state.settings.invites,
  inviteEmail: '',
  inviteMessage: '',
  showMessageField: false,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClearError: () => dispatch(SettingsGen.createInvitesClearError()),
  onGenerateInvitation: (email: string, message: string) =>
    dispatch(SettingsGen.createInvitesSend({email, message})),
  onReclaimInvitation: (inviteId: string) => dispatch(SettingsGen.createInvitesReclaim({inviteId})),
  onRefresh: () => dispatch(SettingsGen.createInvitesRefresh()),
  onSelectPendingInvite: (invite: PendingInvite) =>
    dispatch(navigateAppend([{props: {email: invite.email, link: invite.url}, selected: 'inviteSent'}])),
  onSelectUser: (username: string) => dispatch(createShowUserProfile({username})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount() {
      this.props.onRefresh()
    },
  })
)(Invites)
