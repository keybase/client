import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as Container from '../../util/container'
import ReallyDeleteTeam from '.'
import {deleteTeamWaitingKey} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{teamname: string}>

export default Container.compose(
  Container.connect(
    (state, ownProps: OwnProps) => {
      const teamname = Container.getRouteProps(ownProps, 'teamname', '')
      return {
        deleteWaiting: anyWaiting(state, deleteTeamWaitingKey(teamname)),
        teamname,
      }
    },
    dispatch => ({
      clearError: (teamname: string) =>
        dispatch(WaitingGen.createClearWaiting({key: deleteTeamWaitingKey(teamname)})),
      onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
      onDelete: (teamname: string) => dispatch(TeamsGen.createDeleteTeam({teamname})),
    }),
    (stateProps, dispatchProps, _: OwnProps) => ({
      clearWaiting: () => dispatchProps.clearError(stateProps.teamname),
      deleteWaiting: stateProps.deleteWaiting,
      onBack: stateProps.deleteWaiting ? () => {} : dispatchProps.onBack,
      onDelete: () => dispatchProps.onDelete(stateProps.teamname),
      teamname: stateProps.teamname,
    })
  ),
  Container.safeSubmit(['onDelete'], ['deleteWaiting'])
)(ReallyDeleteTeam)
