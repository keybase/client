import * as C from '@/constants'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import Main from './main'
import {useTeamsSubscribe} from './subscriber'
import {useActivityLevels} from './common'
import {useRouteNavigation} from '@/constants/router'

const orderTeams = (
  teams: ReadonlyMap<string, T.Teams.TeamMeta>,
  newRequests: T.Immutable<Teams.State['newTeamRequests']>,
  teamIDToResetUsers: T.Immutable<Teams.State['teamIDToResetUsers']>,
  newTeams: T.Immutable<Teams.State['newTeams']>,
  sortOrder: T.Immutable<T.Teams.TeamListSort>,
  activityLevels: T.Immutable<T.Teams.ActivityLevels>,
  filter: string
): Array<T.Teams.TeamMeta> => {
  const filterLC = filter.toLowerCase().trim()
  const teamsFiltered = filter
    ? [...teams.values()].filter(meta => meta.teamname.toLowerCase().includes(filterLC))
    : [...teams.values()]
  return teamsFiltered.sort((a, b) => {
    const sizeDiff =
      Teams.getTeamRowBadgeCount(newRequests, teamIDToResetUsers, b.id) -
      Teams.getTeamRowBadgeCount(newRequests, teamIDToResetUsers, a.id)
    if (sizeDiff !== 0) return sizeDiff
    const newTeamsDiff = (newTeams.has(b.id) ? 1 : 0) - (newTeams.has(a.id) ? 1 : 0)
    if (newTeamsDiff !== 0) return newTeamsDiff
    const nameCompare = a.teamname.localeCompare(b.teamname)
    switch (sortOrder) {
      case 'role':
        return Teams.compareTeamRoles(a.role, b.role) || nameCompare
      case 'activity': {
        const activityA = activityLevels.teams.get(a.id)
        const activityB = activityLevels.teams.get(b.id)
        return Teams.compareActivityLevels(activityA, activityB) || nameCompare
      }
      default:
        return nameCompare
    }
  })
}

const Connected = () => {
  const data = Teams.useTeamsState(
    C.useShallow(s => {
      const {deletedTeams, activityLevels, teamMeta, teamListFilter, dispatch} = s
      const {newTeamRequests, newTeams, teamListSort, teamIDToResetUsers} = s
      const {getTeams, launchNewTeamWizardOrModal} = dispatch
      return {
        activityLevels,
        deletedTeams,
        getTeams,
        launchNewTeamWizardOrModal,
        newTeamRequests,
        newTeams,
        teamIDToResetUsers,
        teamListFilter,
        teamListSort,
        teamMeta,
      }
    })
  )
  const {activityLevels, deletedTeams, newTeamRequests, newTeams} = data
  const {teamIDToResetUsers, teamListFilter: filter, teamListSort: sortOrder, teamMeta: _teams} = data
  const {getTeams, launchNewTeamWizardOrModal} = data

  const teams = orderTeams(_teams, newTeamRequests, teamIDToResetUsers, newTeams, sortOrder, activityLevels, filter)

  // subscribe to teams changes
  useTeamsSubscribe()
  // reload activity levels
  useActivityLevels(true)

  const nav = useRouteNavigation()
  const onCreateTeam = () => launchNewTeamWizardOrModal()
  const onJoinTeam = () => nav.navigateAppend('teamJoinTeamDialog')

  return (
    <Kb.Reloadable waitingKeys={C.waitingKeyTeamsLoaded} onReload={getTeams}>
      <Main
        onCreateTeam={onCreateTeam}
        onJoinTeam={onJoinTeam}
        deletedTeams={deletedTeams}
        teams={teams}
      />
    </Kb.Reloadable>
  )
}

export default Connected
