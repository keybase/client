import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
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
        _deleting: anyWaiting(state, deleteTeamWaitingKey(teamname)),
        teamname,
      }
    },

    dispatch => ({
      onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
      onDelete: (teamname: string) => dispatch(TeamsGen.createDeleteTeam({teamname})),
    }),
    (stateProps, dispatchProps, _: OwnProps) => ({
      _deleting: stateProps._deleting,
      onBack: stateProps._deleting ? () => {} : dispatchProps.onBack,
      onDelete: () => dispatchProps.onDelete(stateProps.teamname),
      teamname: stateProps.teamname,
    })
  ),
  Container.safeSubmit(['onDelete'], ['_deleting'])
)(ReallyDeleteTeam)
