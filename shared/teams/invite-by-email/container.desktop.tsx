import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<{teamname: string}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamname = Container.getRouteProps(ownProps, 'teamname', '')
    const inviteError = Constants.getEmailInviteError(state)
    return {
      errorMessage: inviteError.message,
      malformedEmails: inviteError.malformed,
      name: teamname,
      waitingKey: Constants.addToTeamByEmailWaitingKey(teamname) || '',
    }
  },
  (dispatch, ownProps) => ({
    onClearInviteError: () => dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''})), // should only be called on unmount
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
    onInvite: (invitees: string, role: Types.TeamRoleType) => {
      const teamname = Container.getRouteProps(ownProps, 'teamname', '')
      dispatch(TeamsGen.createInviteToTeamByEmail({invitees, role, teamname}))
      dispatch(TeamsGen.createGetTeams())
    },
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(InviteByEmailDesktop)
