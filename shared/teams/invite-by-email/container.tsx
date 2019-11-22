import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<{teamID: string}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', '')
    const {teamname} = Constants.getTeamDetails(state, teamID)
    const inviteError = Constants.getEmailInviteError(state)
    return {
      errorMessage: inviteError.message,
      malformedEmails: inviteError.malformed,
      name: teamname,
      waitingKey: Constants.addToTeamByEmailWaitingKey(teamname) || '',
    }
  },
  dispatch => ({
    _onInvite: (teamname: string, invitees: string, role: Types.TeamRoleType) => {
      dispatch(TeamsGen.createInviteToTeamByEmail({invitees, role, teamname}))
    },
    onClearInviteError: () => dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''})), // should only be called on unmount
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    onClearInviteError: d.onClearInviteError,
    onClose: d.onClose,
    onInvite: (invitees: string, role: Types.TeamRoleType) => d._onInvite(s.name, invitees, role),
  })
)(InviteByEmailDesktop)
