import * as C from '@/constants'
import * as React from 'react'
import * as Container from '@/util/container'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import Teams, {type OwnProps as MainOwnProps} from './main'
import openURL from '@/util/open-url'
import {useTeamsSubscribe} from './subscriber'
import {useActivityLevels} from './common'

// share some between headerRightActions on desktop and component on mobile
const useHeaderActions = () => {
  const nav = Container.useSafeNavigation()
  const launchNewTeamWizardOrModal = C.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  return {
    onCreateTeam: () => launchNewTeamWizardOrModal(),
    onJoinTeam: () => nav.safeNavigateAppend('teamJoinTeamDialog'),
  }
}

const orderTeams = (
  teams: ReadonlyMap<string, T.Teams.TeamMeta>,
  newRequests: T.Immutable<C.Teams.State['newTeamRequests']>,
  teamIDToResetUsers: T.Immutable<C.Teams.State['teamIDToResetUsers']>,
  newTeams: T.Immutable<C.Teams.State['newTeams']>,
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
      C.Teams.getTeamRowBadgeCount(newRequests, teamIDToResetUsers, b.id) -
      C.Teams.getTeamRowBadgeCount(newRequests, teamIDToResetUsers, a.id)
    if (sizeDiff !== 0) return sizeDiff
    const newTeamsDiff = (newTeams.has(b.id) ? 1 : 0) - (newTeams.has(a.id) ? 1 : 0)
    if (newTeamsDiff !== 0) return newTeamsDiff
    const nameCompare = a.teamname.localeCompare(b.teamname)
    switch (sortOrder) {
      case 'role':
        return C.Teams.compareTeamRoles(a.role, b.role) || nameCompare
      case 'activity': {
        const activityA = activityLevels.teams.get(a.id)
        const activityB = activityLevels.teams.get(b.id)
        return C.Teams.compareActivityLevels(activityA, activityB) || nameCompare
      }
      default:
        return nameCompare
    }
  })
}

type ReloadableProps = Omit<MainOwnProps, 'onManageChat' | 'onViewTeam'>

const Reloadable = (props: ReloadableProps) => {
  const getTeams = C.useTeamsState(s => s.dispatch.getTeams)
  const loadTeams = getTeams

  // subscribe to teams changes
  useTeamsSubscribe()
  // reload activity levels
  useActivityLevels(true)

  const headerActions = useHeaderActions()

  const nav = Container.useSafeNavigation()
  const manageChatChannels = C.useTeamsState(s => s.dispatch.manageChatChannels)
  const otherActions = {
    onManageChat: (teamID: T.Teams.TeamID) => manageChatChannels(teamID),
    onViewTeam: (teamID: T.Teams.TeamID) => nav.safeNavigateAppend({props: {teamID}, selected: 'team'}),
  }

  return (
    <Kb.Reloadable waitingKeys={C.Teams.teamsLoadedWaitingKey} onReload={loadTeams}>
      <Teams {...props} {...headerActions} {...otherActions} />
    </Kb.Reloadable>
  )
}

const Connected = () => {
  const data = C.useTeamsState(
    C.useShallow(s => {
      const {deletedTeams, activityLevels, teamMeta, teamListFilter} = s
      const {newTeamRequests, newTeams, teamListSort, teamIDToResetUsers} = s
      return {
        activityLevels,
        deletedTeams,
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
  const loaded = !C.Waiting.useAnyWaiting(C.Teams.teamsLoadedWaitingKey)

  const updateGregorCategory = C.useConfigState(s => s.dispatch.updateGregorCategory)
  const onHideChatBanner = () => {
    updateGregorCategory('sawChatBanner', 'true')
  }
  const onOpenFolder = (teamname: T.Teams.Teamname) => {
    C.FS.makeActionForOpenPathInFilesTab(T.FS.stringToPath(`/keybase/team/${teamname}`))
  }
  const onReadMore = () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  }

  const teams = React.useMemo(
    () =>
      orderTeams(_teams, newTeamRequests, teamIDToResetUsers, newTeams, sortOrder, activityLevels, filter),
    [_teams, newTeamRequests, teamIDToResetUsers, newTeams, sortOrder, activityLevels, filter]
  )

  return (
    <Reloadable
      deletedTeams={deletedTeams}
      loaded={loaded}
      newTeamRequests={newTeamRequests}
      newTeams={newTeams}
      onHideChatBanner={onHideChatBanner}
      onOpenFolder={onOpenFolder}
      onReadMore={onReadMore}
      teams={teams}
      teamresetusers={teamIDToResetUsers}
    />
  )
}

export default Connected
