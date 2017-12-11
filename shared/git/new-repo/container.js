// @flow
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import * as TeamsGen from '../../actions/teams-gen'
import * as I from 'immutable'
import NewRepo from '.'
import {compose, lifecycle, mapProps, connect, type TypedState} from '../../util/container'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  _teams: state.entities.getIn(['teams', 'teamnames'], I.Set()),
  error: Constants.getError(state),
  isTeam: routeProps.get('isTeam'),
  loading: Constants.getLoading(state),
})

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp, routeProps}) => ({
  _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  onClose: () => dispatch(navigateUp()),
  onCreate: (name: string, teamname: ?string, notifyTeam: boolean) => {
    const createAction = routeProps.get('isTeam') && teamname
      ? GitGen.createCreateTeamRepo({teamname, name, notifyTeam})
      : GitGen.createCreatePersonalRepo({name})
    dispatch(createAction)
  },
  onNewTeam: () => dispatch(navigateTo([teamsTab], ['showNewTeamDialog'])),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  mapProps(props => ({
    ...props,
    teams: props._teams.toArray().sort(),
  })),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeams()
    },
  })
)(NewRepo)
