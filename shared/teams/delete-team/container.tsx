import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import ReallyDeleteTeam from '.'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
    const {teamname} = Constants.getTeamDetails(state, teamID)
    return {
      deleteWaiting: anyWaiting(state, Constants.deleteTeamWaitingKey(teamID)),
      teamID,
      teamname,
    }
  },
  dispatch => ({
    clearError: (teamname: string) =>
      dispatch(WaitingGen.createClearWaiting({key: Constants.deleteTeamWaitingKey(teamname)})),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onDelete: (teamID: string) => dispatch(TeamsGen.createDeleteTeam({teamID})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    clearWaiting: () => dispatchProps.clearError(stateProps.teamname),
    deleteWaiting: stateProps.deleteWaiting,
    onBack: stateProps.deleteWaiting ? () => {} : dispatchProps.onBack,
    onDelete: () => dispatchProps.onDelete(stateProps.teamID),
    teamname: stateProps.teamname,
  })
)(Container.safeSubmit(['onDelete'], ['deleteWaiting'])(ReallyDeleteTeam))
