import * as Constants from '../../constants/settings'
import * as ProfileConstants from '../../constants/profile'
import * as SettingsGen from '../../actions/settings-gen'
import type * as Types from '../../constants/types/settings'
import Invites from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

export default () => {
  const acceptedInvites = Container.useSelector(state => state.settings.invites.acceptedInvites)
  const error = Container.useSelector(state => state.settings.invites.error)
  const inviteEmail = ''
  const inviteMessage = ''
  const pendingInvites = Container.useSelector(state => state.settings.invites.pendingInvites)
  const showMessageField = false
  const waitingForResponse = Container.useAnyWaiting(Constants.settingsWaitingKey)

  const dispatch = Container.useDispatch()
  const onClearError = () => {
    dispatch(SettingsGen.createInvitesClearError())
  }
  const onGenerateInvitation = (email: string, message: string) => {
    dispatch(SettingsGen.createInvitesSend({email, message}))
  }
  const onReclaimInvitation = (inviteId: string) => {
    dispatch(SettingsGen.createInvitesReclaim({inviteId}))
  }
  const onRefresh = () => {
    dispatch(SettingsGen.createInvitesRefresh())
  }
  const onSelectPendingInvite = (invite: Types.PendingInvite) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {email: invite.email, link: invite.url}, selected: 'inviteSent'}],
      })
    )
  }

  const onSelectUser = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const props = {
    acceptedInvites: acceptedInvites,
    error: error,
    inviteEmail: inviteEmail,
    inviteMessage: inviteMessage,
    onClearError: onClearError,
    onGenerateInvitation: onGenerateInvitation,
    onReclaimInvitation: onReclaimInvitation,
    onRefresh: onRefresh,
    onSelectPendingInvite: onSelectPendingInvite,
    onSelectUser: onSelectUser,
    pendingInvites: pendingInvites,
    showMessageField: showMessageField,
    waitingForResponse: waitingForResponse,
  }
  return <Invites {...props} />
}
