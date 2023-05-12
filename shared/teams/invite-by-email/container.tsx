import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import type * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'

type OwnProps = Container.RouteProps2<'teamInviteByEmail'>

export default (ownProps: OwnProps) => {
  const teamID = ownProps.route.params.teamID
  const {teamname} = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const inviteError = Container.useSelector(state => Constants.getEmailInviteError(state))
  const errorMessage = inviteError.message
  const malformedEmails = inviteError.malformed
  const name = teamname
  const waitingKey = Constants.addToTeamByEmailWaitingKey(teamname) || ''
  const dispatch = Container.useDispatch()
  const _onInvite = (teamname: string, teamID: Types.TeamID, invitees: string, role: Types.TeamRoleType) => {
    dispatch(TeamsGen.createInviteToTeamByEmail({invitees, role, teamID, teamname}))
  }
  const onClearInviteError = () => {
    dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''}))
  } // should only be called on unmount
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
