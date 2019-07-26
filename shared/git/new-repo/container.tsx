import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import * as TeamsGen from '../../actions/teams-gen'
import NewRepo from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {teamsTab} from '../../constants/tabs'
import {getSortedTeamnames} from '../../constants/teams'

type OwnProps = Container.RouteProps<{isTeam: boolean}>

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    error: Constants.getError(state),
    isTeam: !!Container.getRouteProps(ownProps, 'isTeam', false),
    teams: getSortedTeamnames(state),
    waitingKey: Constants.loadingWaitingKey,
  }),
  (dispatch, ownProps: OwnProps) => ({
    loadTeams: () => dispatch(TeamsGen.createGetTeams()),
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
    onCreate: (name: string, teamname: string | null, notifyTeam: boolean) => {
      const isTeam = !!Container.getRouteProps(ownProps, 'isTeam', false)
      const createAction =
        isTeam && teamname
          ? GitGen.createCreateTeamRepo({name, notifyTeam, teamname})
          : GitGen.createCreatePersonalRepo({name})
      dispatch(createAction)
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onNewTeam: () => dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, 'teamNewTeamDialog']})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(NewRepo)
