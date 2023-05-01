import * as Container from '../../../util/container'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/tracker2'
import {noTeamID} from '../../../constants/types/teams'
import Teams, {type Props} from '.'

type OwnProps = {
  username: string
}

const noTeams = []

export default (ownProps: OwnProps) => {
  const d = Container.useSelector(state => Constants.getDetails(state, ownProps.username))
  const _isYou = Container.useSelector(state => state.config.username === ownProps.username)
  const _roles = Container.useSelector(state => state.teams.teamRoleMap.roles)
  const _teamNameToID = Container.useSelector(state => state.teams.teamNameToID)
  const _youAreInTeams = Container.useSelector(state => state.teams.teamnames.size > 0)
  const teamShowcase = d.teamShowcase || noTeams

  const dispatch = Container.useDispatch()
  const onEdit = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['profileShowcaseTeamOffer']}))
  }
  const onJoinTeam = (teamname: string) => {
    dispatch(TeamsGen.createJoinTeam({teamname}))
  }
  const onViewTeam = (teamname: string) => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(TeamsGen.createShowTeamByName({teamname}))
  }
  const props = {
    onEdit: _isYou && _youAreInTeams ? onEdit : undefined,
    onJoinTeam: onJoinTeam,
    onViewTeam: onViewTeam,
    teamMeta: teamShowcase.reduce<Props['teamMeta']>((map, t) => {
      const teamID = _teamNameToID.get(t.name) || noTeamID
      map[t.name] = {
        inTeam: !!((_roles.get(teamID)?.role || 'none') !== 'none'),
        teamID,
      }
      return map
    }, {}),
    teamShowcase: teamShowcase,
  }
  return <Teams {...props} />
}
