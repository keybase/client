import * as C from '../../constants'
import * as Constants from '../../constants/teams'
import type * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'

type OwnProps = {teamID: string}

export default (ownProps: OwnProps) => {
  const teamID = ownProps.teamID
  const {teamname} = C.useTeamsState(s => Constants.getTeamMeta(s, teamID))
  const inviteError = C.useTeamsState(s => s.errorInEmailInvite)
  const errorMessage = inviteError.message
  const malformedEmails = inviteError.malformed
  const name = teamname
  const waitingKey = Constants.addToTeamByEmailWaitingKey(teamname) || ''
  const inviteToTeamByEmail = C.useTeamsState(s => s.dispatch.inviteToTeamByEmail)
  const _onInvite = (teamname: string, teamID: Types.TeamID, invitees: string, role: Types.TeamRoleType) => {
    inviteToTeamByEmail(invitees, role, teamID, teamname)
  }
  const resetErrorInEmailInvite = C.useTeamsState(s => s.dispatch.resetErrorInEmailInvite)
  // should only be called on unmount
  const onClearInviteError = resetErrorInEmailInvite
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onClose = () => {
    navigateUp()
  }
  const props = {
    errorMessage,
    malformedEmails,
    name,
    onClearInviteError: onClearInviteError,
    onClose: onClose,
    onInvite: (invitees: string, role: Types.TeamRoleType) => {
      _onInvite(name, teamID, invitees, role)
    },
    teamID,
    waitingKey,
  }
  return <InviteByEmailDesktop {...props} />
}
