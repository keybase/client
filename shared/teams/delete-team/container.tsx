import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import ReallyDeleteTeam from '.'
import {deleteTeamWaitingKey} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<
  {
    teamname: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname')
  return {
    _deleting: anyWaiting(state, deleteTeamWaitingKey(teamname)),
    teamname,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onDelete: teamname => dispatch(TeamsGen.createDeleteTeam({teamname})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _deleting: stateProps._deleting,
  onBack: stateProps._deleting ? () => {} : dispatchProps.onBack,
  onDelete: () => dispatchProps.onDelete(stateProps.teamname),
  teamname: stateProps.teamname,
})

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.safeSubmit(['onDelete'], ['_deleting'])
)(ReallyDeleteTeam)
