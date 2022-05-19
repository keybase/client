import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import RenameTeam from '.'

type OwnProps = Container.RouteProps<'teamRename'>

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    error: Container.anyErrors(state, Constants.teamRenameWaitingKey),
    teamname: ownProps.route.params?.teamname ?? '',
    waiting: Container.anyWaiting(state, Constants.teamRenameWaitingKey),
  }),
  dispatch => ({
    _onRename: (oldName, newName) => dispatch(TeamsGen.createRenameTeam({newName, oldName})),
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
    onRename: newName => dispatchProps._onRename(stateProps.teamname, newName),
    onSuccess: dispatchProps.onSuccess,
    teamname: stateProps.teamname,
    waiting: stateProps.waiting,
  })
)(RenameTeam)
