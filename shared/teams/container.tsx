import * as C from '@/constants'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as FS from '@/stores/fs'
import Main from './main'
import openURL from '@/util/open-url'
import {useTeamsSubscribe} from './subscriber'
import {useActivityLevels} from './common'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useConfigState} from '@/stores/config'

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
      const {getTeams, launchNewTeamWizardOrModal, manageChatChannels} = dispatch
      return {
        activityLevels,
        deletedTeams,
        getTeams,
        launchNewTeamWizardOrModal,
        manageChatChannels,
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
  const {getTeams, launchNewTeamWizardOrModal, manageChatChannels} = data

  const loaded = !C.Waiting.useAnyWaiting(C.waitingKeyTeamsLoaded)

  const updateGregorCategory = useConfigState(s => s.dispatch.updateGregorCategory)
  const onHideChatBanner = () => {
    updateGregorCategory('sawChatBanner', 'true')
  }
  const onOpenFolder = (teamname: T.Teams.Teamname) => {
    FS.navToPath(T.FS.stringToPath(`/keybase/team/${teamname}`))
  }
  const onReadMore = () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  }

  const teams = React.useMemo(
    () =>
      orderTeams(_teams, newTeamRequests, teamIDToResetUsers, newTeams, sortOrder, activityLevels, filter),
    [_teams, newTeamRequests, teamIDToResetUsers, newTeams, sortOrder, activityLevels, filter]
  )

  const loadTeams = getTeams

  // subscribe to teams changes
  useTeamsSubscribe()
  // reload activity levels
  useActivityLevels(true)

  const nav = useSafeNavigation()
  const onCreateTeam = () => launchNewTeamWizardOrModal()
  const onJoinTeam = () => nav.safeNavigateAppend('teamJoinTeamDialog')

  const onManageChat = (teamID: T.Teams.TeamID) => manageChatChannels(teamID)
  const onViewTeam = (teamID: T.Teams.TeamID) => nav.safeNavigateAppend({props: {teamID}, selected: 'team'})

  return (
    <Kb.Reloadable waitingKeys={C.waitingKeyTeamsLoaded} onReload={loadTeams}>
      <Main
        onCreateTeam={onCreateTeam}
        onJoinTeam={onJoinTeam}
        onManageChat={onManageChat}
        onViewTeam={onViewTeam}
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
    </Kb.Reloadable>
  )
}

export default Connected
