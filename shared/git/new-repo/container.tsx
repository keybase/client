import * as Constants from '../../constants/git'
import * as Container from '../../util/container'
import * as GitGen from '../../actions/git-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import NewRepo from '.'
import {getSortedTeamnames} from '../../constants/teams'
import {teamsTab} from '../../constants/tabs'

type OwnProps = Container.RouteProps<'gitNewRepo'>

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    error: Constants.getError(state),
    isTeam: !!ownProps.route.params?.isTeam ?? false,
    teams: getSortedTeamnames(state),
    waitingKey: Constants.loadingWaitingKey,
  }),
  (dispatch, ownProps: OwnProps) => ({
    loadTeams: () => dispatch(TeamsGen.createGetTeams()),
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
    onCreate: (name: string, teamname: string | null, notifyTeam: boolean) => {
      const isTeam = !!ownProps.route.params?.isTeam ?? false
      const createAction =
        isTeam && teamname
          ? GitGen.createCreateTeamRepo({name, notifyTeam, teamname})
          : GitGen.createCreatePersonalRepo({name})
      dispatch(createAction)
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onNewTeam: () => {
      dispatch(RouteTreeGen.createSwitchTab({tab: teamsTab}))
      dispatch(TeamsGen.createLaunchNewTeamWizardOrModal())
    },
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(NewRepo)
