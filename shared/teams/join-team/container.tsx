import * as C from '../../constants'
import * as Constants from '../../constants/teams'
import JoinTeam from '.'
import upperFirst from 'lodash/upperFirst'

type OwnProps = {initialTeamname?: string}

export default (ownProps: OwnProps) => {
  const initialTeamname = ownProps.initialTeamname
  const errorText = Constants.useState(s => upperFirst(s.errorInTeamJoin))
  const open = Constants.useState(s => s.teamJoinSuccessOpen)
  const success = Constants.useState(s => s.teamJoinSuccess)
  const successTeamName = Constants.useState(s => s.teamJoinSuccessTeamName)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const joinTeam = Constants.useState(s => s.dispatch.joinTeam)
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
