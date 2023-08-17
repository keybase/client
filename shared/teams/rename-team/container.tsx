import * as C from '../../constants'
import * as Container from '../../util/container'
import * as WaitConstants from '../../constants/waiting'
import * as Constants from '../../constants/teams'
import RenameTeam from '.'

type OwnProps = {teamname: string}

export default (ownProps: OwnProps) => {
  const teamname = ownProps.teamname
  const error = WaitConstants.useAnyErrors(Constants.teamRenameWaitingKey)
  const waiting = WaitConstants.useAnyWaiting(Constants.teamRenameWaitingKey)
  const dispatchClearWaiting = Container.useDispatchClearWaiting()
  const renameTeam = C.useTeamsState(s => s.dispatch.renameTeam)
  const _onRename = renameTeam
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    dispatchClearWaiting(Constants.teamRenameWaitingKey)
    navigateUp()
  }
  const onSuccess = () => {
    navigateUp()
  }
  const props = {
    error: (!error ? undefined : error.message) || '',
    onCancel: onCancel,
    onRename: (newName: string) => _onRename(teamname, newName),
    onSuccess: onSuccess,
    teamname: teamname,
    waiting: waiting,
  }
  return <RenameTeam {...props} />
}
