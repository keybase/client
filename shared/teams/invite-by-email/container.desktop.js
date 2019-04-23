// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'
import {connect, getRouteProps, type RouteProps} from '../../util/container'
import flags from '../../util/feature-flags'

type OwnProps = RouteProps<{teamname: string}, {}>

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
    if (flags.useNewRouter) {
      dispatch(TeamsGen.createInviteToTeamByEmail({invitees, role, teamname}))
    } else {
      const rootPath = ownProps.routePath.take(1)
      const sourceSubPath = ownProps.routePath.rest()
      const destSubPath = sourceSubPath.butLast()
      dispatch(
        TeamsGen.createInviteToTeamByEmail({
          destSubPath,
          invitees,
          role,
          rootPath,
          sourceSubPath,
          teamname,
        })
      )
    }
    dispatch(TeamsGen.createGetTeams({clearNavBadges: false}))
  },
  onOpenRolePicker: (role: Types.TeamRoleType, onComplete: Types.TeamRoleType => void) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              allowOwner: false,
              onComplete,
              selectedRole: role,
            },
            selected: 'teamControlledRolePicker',
          },
        ],
      })
    )
  },
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(InviteByEmailDesktop)
