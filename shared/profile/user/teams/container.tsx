import * as Container from '../../../util/container'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/tracker2'
import Teams, {Props} from '.'

type OwnProps = {
  username: string
}

const noTeams = []

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const d = Constants.getDetails(state, ownProps.username)
    return {
      _isYou: state.config.username === ownProps.username,
      _roles: state.teams.teamNameToRole,
      _youAreInTeams: state.teams.teamnames.count() > 0,
      teamShowcase: d.teamShowcase || noTeams,
    }
  },
  dispatch => ({
    onEdit: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileShowcaseTeamOffer']})),
    onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
    onViewTeam: (teamname: string) => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    onEdit: stateProps._isYou && stateProps._youAreInTeams ? dispatchProps.onEdit : undefined,
    onJoinTeam: dispatchProps.onJoinTeam,
    onViewTeam: dispatchProps.onViewTeam,
    teamMeta: stateProps.teamShowcase.reduce<Props['teamMeta']>((map, t) => {
      map[t.name] = {
        inTeam: !!stateProps._roles.get(t.name),
      }
      return map
    }, {}),
    teamShowcase: stateProps.teamShowcase,
  }),
  'Teams'
)(Teams)
