import * as Container from '../../../util/container'
import * as ConfigConstants from '../../../constants/config'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/tracker2'
import * as TeamsConstants from '../../../constants/teams'
import type * as Types from '../../../constants/types/tracker2'
import {noTeamID} from '../../../constants/types/teams'
import Teams, {type Props} from '.'

type OwnProps = {
  username: string
}

const noTeams = new Array<Types.TeamShowcase>()

export default (ownProps: OwnProps) => {
  const d = Container.useSelector(state => Constants.getDetails(state, ownProps.username))
  const _isYou = ConfigConstants.useCurrentUserState(s => s.username === ownProps.username)
  const _roles = Container.useSelector(state => state.teams.teamRoleMap.roles)
  const _teamNameToID = TeamsConstants.useState(s => s.teamNameToID)
  const _youAreInTeams = TeamsConstants.useState(s => s.teamnames.size > 0)
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
