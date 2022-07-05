import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import ReallyDeleteTeam from '.'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
    const {teamname} = Constants.getTeamMeta(state, teamID)
    const teamDetails = Constants.getTeamDetails(state, teamID)
    return {
      deleteWaiting: anyWaiting(state, Constants.deleteTeamWaitingKey(teamID)),
      teamDetails,
      teamID,
      teamMetas: state.teams.teamMeta,
      teamname,
    }
  },
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onDelete: (teamID: string) => dispatch(TeamsGen.createDeleteTeam({teamID})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    deleteWaiting: stateProps.deleteWaiting,
    onBack: stateProps.deleteWaiting ? () => {} : dispatchProps.onBack,
    onDelete: () => dispatchProps.onDelete(stateProps.teamID),
    subteamNames: stateProps.teamDetails.subteams.size
      ? [...stateProps.teamDetails.subteams]
          .map(subteamID => stateProps.teamMetas.get(subteamID)?.teamname ?? '')
          .filter(name => !!name)
      : undefined,
    teamID: stateProps.teamID,
    teamname: stateProps.teamname,
  })
)(Container.safeSubmit(['onDelete'], ['deleteWaiting'])(ReallyDeleteTeam))
