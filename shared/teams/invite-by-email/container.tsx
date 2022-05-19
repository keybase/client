import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import type * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'

type OwnProps = Container.RouteProps<'teamInviteByEmail'>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = ownProps.route.params?.teamID ?? ''
    const {teamname} = Constants.getTeamMeta(state, teamID)
    const inviteError = Constants.getEmailInviteError(state)
    return {
      errorMessage: inviteError.message,
      malformedEmails: inviteError.malformed,
      name: teamname,
      waitingKey: Constants.addToTeamByEmailWaitingKey(teamname) || '',
    }
  },
  dispatch => ({
    _onInvite: (teamname: string, teamID: Types.TeamID, invitees: string, role: Types.TeamRoleType) => {
      dispatch(TeamsGen.createInviteToTeamByEmail({invitees, role, teamID, teamname}))
    },
    onClearInviteError: () => dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''})), // should only be called on unmount
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    onClearInviteError: d.onClearInviteError,
    onClose: d.onClose,
    onInvite: (invitees: string, role: Types.TeamRoleType) => {
      const teamID = o.route.params?.teamID ?? ''
      d._onInvite(s.name, teamID, invitees, role)
    },
  })
)(InviteByEmailDesktop)
