// @flow
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import * as TeamsGen from '../../actions/teams-gen'
import NewRepo from '.'
import {connect, type RouteProps} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {teamsTab} from '../../constants/tabs'
import {getSortedTeamnames} from '../../constants/teams'

type OwnProps = RouteProps<{isTeam: boolean}, {}>

const mapStateToProps = (state, {routeProps}) => ({
  error: Constants.getError(state),
  isTeam: routeProps.get('isTeam'),
  teams: getSortedTeamnames(state),
  waitingKey: Constants.loadingWaitingKey,
})

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp, routeProps}) => ({
  loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  onClose: () => dispatch(navigateUp()),
  onCreate: (name: string, teamname: ?string, notifyTeam: boolean) => {
    const createAction =
      routeProps.get('isTeam') && teamname
        ? GitGen.createCreateTeamRepo({name, notifyTeam, teamname})
        : GitGen.createCreatePersonalRepo({name})
    dispatch(createAction)
  },
  onNewTeam: () => dispatch(RouteTreeGen.createNavigateTo({path: [teamsTab, 'showNewTeamDialog']})),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(NewRepo)
