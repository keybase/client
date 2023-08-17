import * as C from '../../constants'
import JoinTeam from '.'
import upperFirst from 'lodash/upperFirst'

type OwnProps = {initialTeamname?: string}

export default (ownProps: OwnProps) => {
  const initialTeamname = ownProps.initialTeamname
  const errorText = C.useTeamsState(s => upperFirst(s.errorInTeamJoin))
  const open = C.useTeamsState(s => s.teamJoinSuccessOpen)
  const success = C.useTeamsState(s => s.teamJoinSuccess)
  const successTeamName = C.useTeamsState(s => s.teamJoinSuccessTeamName)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const joinTeam = C.useTeamsState(s => s.dispatch.joinTeam)
  const onJoinTeam = joinTeam
  const props = {
    errorText,
    initialTeamname,
    onBack,
    onJoinTeam,
    open,
    success,
    successTeamName,
  }
  return <JoinTeam {...props} />
}
