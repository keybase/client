import * as Constants from '../../constants/git'
import * as Container from '../../util/container'
import * as GitGen from '../../actions/git-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import NewRepo from '.'
import {getSortedTeamnames} from '../../constants/teams'
import {teamsTab} from '../../constants/tabs'

type OwnProps = Container.RouteProps<'gitNewRepo'>

export default (ownProps: OwnProps) => {
  const error = Container.useSelector(state => Constants.getError(state))
  const isTeam = !!ownProps.route.params?.isTeam ?? false
  const teams = Container.useSelector(state => getSortedTeamnames(state))
  const waitingKey = Constants.loadingWaitingKey

  const dispatch = Container.useDispatch()
  const loadTeams = () => {
    dispatch(TeamsGen.createGetTeams())
  }
  const onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onCreate = (name: string, teamname: string | null, notifyTeam: boolean) => {
    const isTeam = !!ownProps.route.params?.isTeam ?? false
    const createAction =
      isTeam && teamname
        ? GitGen.createCreateTeamRepo({name, notifyTeam, teamname})
        : GitGen.createCreatePersonalRepo({name})
    dispatch(createAction)
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onNewTeam = () => {
    dispatch(RouteTreeGen.createSwitchTab({tab: teamsTab}))
    dispatch(TeamsGen.createLaunchNewTeamWizardOrModal())
  }
  const props = {
    error,
    isTeam,
    loadTeams,
    onClose,
    onCreate,
    onNewTeam,
    teams,
    waitingKey,
  }
  return <NewRepo {...props} />
}
