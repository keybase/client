import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import RenameTeam from '.'

type OwnProps = Container.RouteProps<{teamname: string}>

export default Container.namedConnect(
  (state, ownProps: OwnProps) => ({
    error: Container.anyErrors(state, Constants.teamRenameWaitingKey),
    teamname: Container.getRouteProps(ownProps, 'teamname', ''),
    waiting: Container.anyWaiting(state, Constants.teamRenameWaitingKey),
  }),
  dispatch => ({
    _onRename: (oldName: string, newName: string) => dispatch(TeamsGen.createRenameTeam({newName, oldName})),
    // TODO shouldn't be doing this clearWaiting here
    onCancel: () => {
      dispatch(WaitingGen.createClearWaiting({key: Constants.teamRenameWaitingKey}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onSuccess: () => {
      dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    error: (!stateProps.error ? undefined : stateProps.error.message) || '',
    onCancel: dispatchProps.onCancel,
    onRename: (newName: string) => dispatchProps._onRename(stateProps.teamname, newName),
    onSuccess: dispatchProps.onSuccess,
    teamname: stateProps.teamname,
    waiting: stateProps.waiting,
  }),

  'RenameTeam'
)(RenameTeam)
