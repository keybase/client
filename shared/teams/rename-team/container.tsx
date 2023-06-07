import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitConstants from '../../constants/waiting'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import RenameTeam from '.'

type OwnProps = {teamname: string}

export default (ownProps: OwnProps) => {
  const teamname = ownProps.teamname
  const error = WaitConstants.useAnyErrors(Constants.teamRenameWaitingKey)
  const waiting = WaitConstants.useAnyWaiting(Constants.teamRenameWaitingKey)
  const dispatchClearWaiting = Container.useDispatchClearWaiting()
  const dispatch = Container.useDispatch()
  const _onRename = (oldName, newName) => {
    dispatch(TeamsGen.createRenameTeam({newName, oldName}))
  }
  const onCancel = () => {
    dispatchClearWaiting(Constants.teamRenameWaitingKey)
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSuccess = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    error: (!error ? undefined : error.message) || '',
    onCancel: onCancel,
    onRename: newName => _onRename(teamname, newName),
    onSuccess: onSuccess,
    teamname: teamname,
    waiting: waiting,
  }
  return <RenameTeam {...props} />
}
