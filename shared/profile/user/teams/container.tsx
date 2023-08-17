import * as C from '../../../constants'
import * as Constants from '../../../constants/tracker2'
import * as T from '../../../constants/types'
import Teams, {type Props} from '.'

type OwnProps = {
  username: string
}

const noTeams = new Array<T.Tracker.TeamShowcase>()

export default (ownProps: OwnProps) => {
  const d = C.useTrackerState(s => Constants.getDetails(s, ownProps.username))
  const _isYou = C.useCurrentUserState(s => s.username === ownProps.username)
  const _roles = C.useTeamsState(s => s.teamRoleMap.roles)
  const _teamNameToID = C.useTeamsState(s => s.teamNameToID)
  const _youAreInTeams = C.useTeamsState(s => s.teamnames.size > 0)
  const teamShowcase = d.teamShowcase || noTeams
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onEdit = () => {
    navigateAppend('profileShowcaseTeamOffer')
  }
  const joinTeam = C.useTeamsState(s => s.dispatch.joinTeam)
  const showTeamByName = C.useTeamsState(s => s.dispatch.showTeamByName)
  const onJoinTeam = joinTeam
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onViewTeam = (teamname: string) => {
    clearModals()
    showTeamByName(teamname)
  }
  const props = {
    onEdit: _isYou && _youAreInTeams ? onEdit : undefined,
    onJoinTeam: onJoinTeam,
    onViewTeam: onViewTeam,
    teamMeta: teamShowcase.reduce<Props['teamMeta']>((map, t) => {
      const teamID = _teamNameToID.get(t.name) || T.Teams.noTeamID
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
