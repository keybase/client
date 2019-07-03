import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import * as TeamsGen from '../../actions/teams-gen'
import NewRepo from '.'
import {connect, RouteProps} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {teamsTab} from '../../constants/tabs'
import {getSortedTeamnames} from '../../constants/teams'

type OwnProps = RouteProps<
  {
    isTeam: boolean
  },
  {}
>

const mapStateToProps = (state, {routeProps, navigation}) => ({
  error: Constants.getError(state),
  isTeam: navigation ? navigation.getParam('isTeam') : routeProps.get('isTeam'),
  teams: getSortedTeamnames(state),
  waitingKey: Constants.loadingWaitingKey,
})

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp, routeProps, navigation}) => ({
  loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  onCancel: () => dispatch(navigateUp()),
  onClose: () => dispatch(navigateUp()),
  onCreate: (name: string, teamname: string | null, notifyTeam: boolean) => {
    const isTeam = navigation ? navigation.getParam('isTeam') : routeProps.get('isTeam')
    const createAction =
      isTeam && teamname
        ? GitGen.createCreateTeamRepo({name, notifyTeam, teamname})
        : GitGen.createCreatePersonalRepo({name})
    dispatch(createAction)
    dispatch(navigateUp())
  },
  onNewTeam: () => dispatch(RouteTreeGen.createNavigateTo({path: [teamsTab, 'teamNewTeamDialog']})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(NewRepo)
