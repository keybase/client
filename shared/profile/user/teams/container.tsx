import * as Container from '../../../util/container'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/tracker2'
import Teams from '.'

type OwnProps = {
  username: string
}

const noTeams = []

const mapStateToProps = (state, ownProps) => {
  const d = Constants.getDetails(state, ownProps.username)
  return {
    _isYou: state.config.username === ownProps.username,
    _roles: state.teams.teamNameToRole,
    _teamShowcase: d.teamShowcase,
    _youAreInTeams: state.teams.teamnames.count() > 0,
  }
}
const mapDispatchToProps = dispatch => ({
  onEdit: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileShowcaseTeamOffer']})),
  onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
  onViewTeam: (teamname: string) => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]}))
  },
})
const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  onEdit: stateProps._isYou && stateProps._youAreInTeams ? dispatchProps.onEdit : null,
  onJoinTeam: dispatchProps.onJoinTeam,
  onViewTeam: dispatchProps.onViewTeam,
  teamMeta: (stateProps._teamShowcase || []).reduce((map, t) => {
    map[t.name] = {
      inTeam: stateProps._roles.get(t.name) || false,
    }
    return map
  }, {}),
  teamShowcase: stateProps._teamShowcase
    ? stateProps._teamShowcase.map(t => t.toObject()).toArray()
    : noTeams,
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Teams')(Teams)
