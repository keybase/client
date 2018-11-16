// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {InviteByEmailDesktop} from '.'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{teamname: string}, {}>

const mapStateToProps = (state, {routeProps}: OwnProps) => {
  const inviteError = Constants.getEmailInviteError(state)
  return {
    errorMessage: inviteError.message,
    malformedEmails: inviteError.malformed,
    name: routeProps.get('teamname'),
    waitingKey: Constants.addToTeamByEmailWaitingKey(routeProps.get('teamname') || ''),
  }
}

const mapDispatchToProps = (dispatch, {navigateAppend, navigateUp, routePath, routeProps}) => ({
  onClearInviteError: () => dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: ''})), // should only be called on unmount
  onClose: () => dispatch(navigateUp()),
  onInvite: (invitees: string, role: Types.TeamRoleType) => {
    const teamname = routeProps.get('teamname')
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
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
    dispatch(TeamsGen.createGetTeams())
  },
  onOpenRolePicker: (role: Types.TeamRoleType, onComplete: Types.TeamRoleType => void) => {
    dispatch(
      navigateAppend([
        {
          props: {
            allowOwner: false,
            onComplete,
            selectedRole: role,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(InviteByEmailDesktop)
