import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'
import {connect, getRouteProps, RouteProps} from '../../util/container'

type OwnProps = RouteProps<
  {
    teamname: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const teamname = getRouteProps(ownProps, 'teamname')
  const inviteError = Constants.getEmailInviteError(state)
  return {
    errorMessage: inviteError.message,
    malformedEmails: inviteError.malformed,
    name: teamname,
    waitingKey: Constants.addToTeamByEmailWaitingKey(teamname) || '',
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  onClearInviteError: () => dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''})), // should only be called on unmount
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  onInvite: (invitees: string, role: Types.TeamRoleType) => {
    const teamname = getRouteProps(ownProps, 'teamname')
    dispatch(TeamsGen.createInviteToTeamByEmail({invitees, role, teamname}))
    dispatch(TeamsGen.createGetTeams())
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(InviteByEmailDesktop)
