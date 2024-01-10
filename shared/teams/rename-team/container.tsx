import * as C from '@/constants'
import RenameTeam from '.'

type OwnProps = {teamname: string}

const Container = (ownProps: OwnProps) => {
  const teamname = ownProps.teamname
  const error = C.Waiting.useAnyErrors(C.Teams.teamRenameWaitingKey)
  const waiting = C.Waiting.useAnyWaiting(C.Teams.teamRenameWaitingKey)
  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  const renameTeam = C.useTeamsState(s => s.dispatch.renameTeam)
  const _onRename = renameTeam
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    dispatchClearWaiting(C.Teams.teamRenameWaitingKey)
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

export default Container
