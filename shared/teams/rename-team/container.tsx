import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import RenameTeam from '.'

type OwnProps = Container.RouteProps<{teamname: string}>

const mapStateToProps = (state, ownProps) => ({
  error: Container.anyErrors(state, Constants.teamRenameWaitingKey),
  teamname: Container.getRouteProps(ownProps, 'teamname', ''),
  waiting: Container.anyWaiting(state, Constants.teamRenameWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  _onRename: (oldName, newName) => dispatch(TeamsGen.createRenameTeam({newName, oldName})),
  onCancel: () => {
    dispatch(WaitingGen.createClearWaiting({key: Constants.teamRenameWaitingKey}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onSuccess: () => {
    dispatch(RouteTreeGen.createNavigateUp())
  },
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  error: (!stateProps.error ? undefined : stateProps.error.message) || '',
  onCancel: dispatchProps.onCancel,
  onRename: newName => dispatchProps._onRename(stateProps.teamname, newName),
  onSuccess: dispatchProps.onSuccess,
  teamname: stateProps.teamname,
  waiting: stateProps.waiting,
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'RenameTeam'
)(RenameTeam)
