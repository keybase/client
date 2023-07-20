import * as Constants from '../../constants/teams'
import * as RouterConstants from '../../constants/router2'
import type * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'

type OwnProps = {teamID: string}

export default (ownProps: OwnProps) => {
  const teamID = ownProps.teamID
  const {teamname} = Constants.useState(s => Constants.getTeamMeta(s, teamID))
  const inviteError = Constants.useState(s => s.errorInEmailInvite)
  const errorMessage = inviteError.message
  const malformedEmails = inviteError.malformed
  const name = teamname
  const waitingKey = Constants.addToTeamByEmailWaitingKey(teamname) || ''
  const inviteToTeamByEmail = Constants.useState(s => s.dispatch.inviteToTeamByEmail)
  const _onInvite = (teamname: string, teamID: Types.TeamID, invitees: string, role: Types.TeamRoleType) => {
    inviteToTeamByEmail(invitees, role, teamID, teamname)
  }
  const resetErrorInEmailInvite = Constants.useState(s => s.dispatch.resetErrorInEmailInvite)
  // should only be called on unmount
  const onClearInviteError = resetErrorInEmailInvite
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
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
