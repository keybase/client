import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import NewTeamDialog from '.'
import upperFirst from 'lodash/upperFirst'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type OwnProps = {subteamOf?: Types.TeamID}

export default (ownProps: OwnProps) => {
  const subteamOf = ownProps.subteamOf ?? Types.noTeamID
  const baseTeam = Container.useSelector(state => Constants.getTeamMeta(state, subteamOf).teamname)
  const errorText = Constants.useState(s => upperFirst(s.errorInTeamCreation))
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const resetErrorInTeamCreation = Constants.useState(s => s.dispatch.resetErrorInTeamCreation)
  const createNewTeam = Constants.useState(s => s.dispatch.createNewTeam)
  const onClearError = resetErrorInTeamCreation
  const onSubmit = (teamname: string, joinSubteam: boolean) => {
    createNewTeam(teamname, joinSubteam)
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
