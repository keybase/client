import * as C from '@/constants'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import Main from './main'
import {useActivityLevels} from './common'
import {useTeamsList} from './use-teams-list'
import {useSafeNavigation} from '@/util/safe-navigation'
import {makeNewTeamWizard} from './new-team/wizard/state'
import {useNavigation} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

type TeamsRootParamList = {
  teamsRoot: {
    filter?: string
    sort?: T.Teams.TeamListSort
  }
}

const orderTeams = (
  teams: ReadonlyArray<T.Teams.TeamMeta>,
  newRequests: T.Immutable<Teams.State['newTeamRequests']>,
  teamIDToResetUsers: T.Immutable<Teams.State['teamIDToResetUsers']>,
  newTeams: T.Immutable<Teams.State['newTeams']>,
  sortOrder: T.Immutable<T.Teams.TeamListSort>,
  activityLevels: T.Immutable<T.Teams.ActivityLevels>,
  filter: string
): Array<T.Teams.TeamMeta> => {
  const filterLC = filter.toLowerCase().trim()
  const teamsFiltered = filter
    ? teams.filter(meta => meta.teamname.toLowerCase().includes(filterLC))
    : [...teams]
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

type Props = {
  filter?: string
  sort?: T.Teams.TeamListSort
}

const Connected = ({filter = '', sort = 'role'}: Props) => {
  const {reload, teams} = useTeamsList()
  const activityLevels = useActivityLevels()
  const data = Teams.useTeamsState(
    C.useShallow(s => {
      const {deletedTeams} = s
      const {newTeamRequests, newTeams, teamIDToResetUsers} = s
      return {
        deletedTeams,
        newTeamRequests,
        newTeams,
        teamIDToResetUsers,
      }
    })
  )
  const {deletedTeams, newTeamRequests, newTeams} = data
  const {teamIDToResetUsers} = data

  const orderedTeams = orderTeams(teams, newTeamRequests, teamIDToResetUsers, newTeams, sort, activityLevels, filter)
  const teamItems = orderedTeams.map(teamMeta => ({
    activityLevel: activityLevels.teams.get(teamMeta.id) || 'none',
    badgeCount: Teams.getTeamRowBadgeCount(newTeamRequests, teamIDToResetUsers, teamMeta.id),
    id: teamMeta.id,
    isNew: newTeams.has(teamMeta.id),
    teamMeta,
  }))

  const nav = useSafeNavigation()
  const navigation = useNavigation<NativeStackNavigationProp<TeamsRootParamList, 'teamsRoot'>>()
  const onCreateTeam = () =>
    nav.safeNavigateAppend({name: 'teamWizard1TeamPurpose', params: {wizard: makeNewTeamWizard()}})
  const onJoinTeam = () => nav.safeNavigateAppend({name: 'teamJoinTeamDialog', params: {}})

  return (
    <Kb.Reloadable waitingKeys={C.waitingKeyTeamsLoaded} onReload={reload}>
      <Main
        onCreateTeam={onCreateTeam}
        onJoinTeam={onJoinTeam}
        deletedTeams={deletedTeams}
        onChangeSort={sortOrder => navigation.setParams({filter, sort: sortOrder})}
        sortOrder={sort}
        teams={teamItems}
      />
    </Kb.Reloadable>
  )
}

export default Connected
