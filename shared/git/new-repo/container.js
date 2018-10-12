// @flow
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import * as TeamsGen from '../../actions/teams-gen'
import NewRepo from '.'
import {compose, lifecycle, connect} from '../../util/container'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'
import {getSortedTeamnames} from '../../constants/teams'

const mapStateToProps = (state, {routeProps}) => ({
  teams: getSortedTeamnames(state),
  error: Constants.getError(state),
  isTeam: routeProps.get('isTeam'),
  waitingKey: Constants.loadingWaitingKey,
})

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp, routeProps}) => ({
  _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  onClose: () => dispatch(navigateUp()),
  onCreate: (name: string, teamname: ?string, notifyTeam: boolean) => {
    const createAction =
      routeProps.get('isTeam') && teamname
        ? GitGen.createCreateTeamRepo({teamname, name, notifyTeam})
        : GitGen.createCreatePersonalRepo({name})
    dispatch(createAction)
  },
  onNewTeam: () => dispatch(navigateTo([teamsTab, 'showNewTeamDialog'])),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props._loadTeams()
    },
  })
)(NewRepo)
