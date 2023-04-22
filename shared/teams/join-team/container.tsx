import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import JoinTeam from '.'
import upperFirst from 'lodash/upperFirst'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<'teamJoinTeamDialog'>

export default (ownProps: OwnProps) => {
  const errorText = Container.useSelector(state => upperFirst(state.teams.errorInTeamJoin))
  const initialTeamname = ownProps.route.params?.initialTeamname ?? undefined
  const open = Container.useSelector(state => state.teams.teamJoinSuccessOpen)
  const success = Container.useSelector(state => state.teams.teamJoinSuccess)
  const successTeamName = Container.useSelector(state => state.teams.teamJoinSuccessTeamName)
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onJoinTeam = (teamname: string) => {
    dispatch(TeamsGen.createJoinTeam({teamname}))
  }
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
