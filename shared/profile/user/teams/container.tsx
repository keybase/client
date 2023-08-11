import * as ConfigConstants from '../../../constants/config'
import * as C from '../../../constants'
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
  const d = Constants.useState(s => Constants.getDetails(s, ownProps.username))
  const _isYou = ConfigConstants.useCurrentUserState(s => s.username === ownProps.username)
  const _roles = TeamsConstants.useState(s => s.teamRoleMap.roles)
  const _teamNameToID = TeamsConstants.useState(s => s.teamNameToID)
  const _youAreInTeams = TeamsConstants.useState(s => s.teamnames.size > 0)
  const teamShowcase = d.teamShowcase || noTeams
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onEdit = () => {
    navigateAppend('profileShowcaseTeamOffer')
  }
  const joinTeam = TeamsConstants.useState(s => s.dispatch.joinTeam)
  const showTeamByName = TeamsConstants.useState(s => s.dispatch.showTeamByName)
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
