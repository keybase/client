import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import NewTeamDialog from '.'
import upperFirst from 'lodash/upperFirst'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type OwnProps = Container.RouteProps2<'teamNewTeamDialog'>

export default (ownProps: OwnProps) => {
  const subteamOf = ownProps.route.params.subteamOf ?? Types.noTeamID
  const baseTeam = Container.useSelector(state => Constants.getTeamMeta(state, subteamOf).teamname)
  const errorText = Container.useSelector(state => upperFirst(state.teams.errorInTeamCreation))
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClearError = () => {
    dispatch(TeamsGen.createSetTeamCreationError({error: ''}))
  }
  const onSubmit = (teamname: string, joinSubteam: boolean) => {
    dispatch(TeamsGen.createCreateNewTeam({joinSubteam, teamname}))
  }
  const props = {
    baseTeam,
    errorText,
    onCancel,
    onClearError,
    onSubmit,
    subteamOf,
  }
  return <NewTeamDialog {...props} />
}
