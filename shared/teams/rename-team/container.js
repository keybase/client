// @flow
import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import RenameTeam from '.'

type OwnProps = Container.RouteProps<{|teamname: string|}, {||}>

const mapStateToProps = (state, ownProps) => ({
  error: '',
  teamname: Container.getRouteProps(ownProps, 'teamname'),
  title: 'Rename subteam',
  waiting: Container.anyWaiting(state, Constants.teamRenameWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  _onRename: (oldName, newName) => dispatch(TeamsGen.createRenameTeam({newName, oldName})),
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  error: stateProps.error,
  onCancel: dispatchProps.onCancel,
  onRename: newName => dispatchProps._onRename(stateProps.teamname, newName),
  teamname: stateProps.teamname,
  title: stateProps.title,
  waiting: stateProps.waiting,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'RenameTeam'
)(RenameTeam)
