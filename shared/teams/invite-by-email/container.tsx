import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import type * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'

type OwnProps = {teamID: string}

export default (ownProps: OwnProps) => {
  const teamID = ownProps.teamID
  const {teamname} = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const inviteError = Constants.useState(s => s.errorInEmailInvite)
  const errorMessage = inviteError.message
  const malformedEmails = inviteError.malformed
  const name = teamname
  const waitingKey = Constants.addToTeamByEmailWaitingKey(teamname) || ''
  const dispatch = Container.useDispatch()
  const inviteToTeamByEmail = Constants.useState(s => s.dispatch.inviteToTeamByEmail)
  const _onInvite = (teamname: string, teamID: Types.TeamID, invitees: string, role: Types.TeamRoleType) => {
    inviteToTeamByEmail(invitees, role, teamID, teamname)
  }
  const resetErrorInEmailInvite = Constants.useState(s => s.dispatch.resetErrorInEmailInvite)
  // should only be called on unmount
  const onClearInviteError = resetErrorInEmailInvite
  const onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
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
