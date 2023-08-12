import * as C from '../../constants'
import * as Constants from '../../constants/settings'
import type {PendingInvite} from '../../constants/settings-invites'
import Invites from '.'
import * as Container from '../../util/container'

export default () => {
  const acceptedInvites = Constants.useInvitesState(s => s.acceptedInvites)
  const error = Constants.useInvitesState(s => s.error)
  const inviteEmail = ''
  const inviteMessage = ''
  const pendingInvites = Constants.useInvitesState(s => s.pendingInvites)
  const showMessageField = false
  const waitingForResponse = Container.useAnyWaiting(Constants.settingsWaitingKey)

  const resetError = Constants.useInvitesState(s => s.dispatch.resetError)
  const sendInvite = Constants.useInvitesState(s => s.dispatch.sendInvite)
  const reclaimInvite = Constants.useInvitesState(s => s.dispatch.reclaimInvite)
  const loadInvites = Constants.useInvitesState(s => s.dispatch.loadInvites)
  const onClearError = resetError
  const onGenerateInvitation = sendInvite
  const onReclaimInvitation = reclaimInvite
  const onRefresh = loadInvites
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onSelectPendingInvite = (invite: PendingInvite) => {
    navigateAppend({props: {email: invite.email, link: invite.url}, selected: 'inviteSent'})
  }

  const onSelectUser = C.useProfileState(s => s.dispatch.showUserProfile)
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
