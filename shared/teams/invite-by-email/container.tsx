import * as C from '@/constants'
import type * as T from '@/constants/types'
import {InviteByEmailDesktop} from '.'

type OwnProps = {teamID: string}

const Container = (ownProps: OwnProps) => {
  const teamID = ownProps.teamID
  const {teamname} = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID))
  const inviteError = C.useTeamsState(s => s.errorInEmailInvite)
  const errorMessage = inviteError.message
  const malformedEmails = inviteError.malformed
  const name = teamname
  const waitingKey = C.Teams.addToTeamByEmailWaitingKey(teamname) || ''
  const inviteToTeamByEmail = C.useTeamsState(s => s.dispatch.inviteToTeamByEmail)
  const _onInvite = (
    teamname: string,
    teamID: T.Teams.TeamID,
    invitees: string,
    role: T.Teams.TeamRoleType
  ) => {
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
    onInvite: (invitees: string, role: T.Teams.TeamRoleType) => {
      _onInvite(name, teamID, invitees, role)
    },
    teamID,
    waitingKey,
  }
  return <InviteByEmailDesktop {...props} />
}

export default Container
