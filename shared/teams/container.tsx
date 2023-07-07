import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import Teams, {type OwnProps as MainOwnProps} from './main'
import openURL from '../util/open-url'
import * as Constants from '../constants/teams'
import type * as Types from '../constants/types/teams'
import {memoize} from '../util/memoize'
import {useTeamsSubscribe} from './subscriber'
import {useActivityLevels} from './common'

// share some between headerRightActions on desktop and component on mobile
const useHeaderActions = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  return {
    onCreateTeam: () => dispatch(TeamsGen.createLaunchNewTeamWizardOrModal()),
    onJoinTeam: () =>
      dispatch(nav.safeNavigateAppendPayload({path: [{props: {}, selected: 'teamJoinTeamDialog'}]})),
  }
}

const orderTeamsImpl = (
  teams: Map<string, Types.TeamMeta>,
  newRequests: Types.State['newTeamRequests'],
  teamIDToResetUsers: Constants.State['teamIDToResetUsers'],
  newTeams: Constants.State['newTeams'],
  sortOrder: Types.TeamListSort,
  activityLevels: Types.ActivityLevels,
  filter: string
): Array<Types.TeamMeta> => {
  const filterLC = filter.toLowerCase().trim()
  const teamsFiltered = filter
    ? [...teams.values()].filter(meta => meta.teamname.toLowerCase().includes(filterLC))
    : [...teams.values()]
  return teamsFiltered.sort((a, b) => {
    const sizeDiff =
      Constants.getTeamRowBadgeCount(newRequests, teamIDToResetUsers, b.id) -
      Constants.getTeamRowBadgeCount(newRequests, teamIDToResetUsers, a.id)
    if (sizeDiff !== 0) return sizeDiff
    const newTeamsDiff = (newTeams.has(b.id) ? 1 : 0) - (newTeams.has(a.id) ? 1 : 0)
    if (newTeamsDiff !== 0) return newTeamsDiff
    const nameCompare = a.teamname.localeCompare(b.teamname)
    switch (sortOrder) {
      case 'role':
        return Constants.compareTeamRoles(a.role, b.role) || nameCompare
      case 'activity': {
        const activityA = activityLevels.teams.get(a.id)
        const activityB = activityLevels.teams.get(b.id)
        return Constants.compareActivityLevels(activityA, activityB) || nameCompare
      }
      default:
        return nameCompare
    }
  })
}

const orderTeams = memoize(orderTeamsImpl)

type ReloadableProps = Omit<MainOwnProps, 'onManageChat' | 'onViewTeam'>

const Reloadable = (props: ReloadableProps) => {
  const dispatch = Container.useDispatch()
  const loadTeams = React.useCallback(() => dispatch(TeamsGen.createGetTeams()), [dispatch])

  // subscribe to teams changes
  useTeamsSubscribe()
  // reload activity levels
  useActivityLevels(true)

  const headerActions = useHeaderActions()

  const nav = Container.useSafeNavigation()
  const otherActions = {
    onManageChat: (teamID: Types.TeamID) => dispatch(TeamsGen.createManageChatChannels({teamID})),
    onViewTeam: (teamID: Types.TeamID) =>
      dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]})),
  }

  return (
    <Kb.Reloadable waitingKeys={Constants.teamsLoadedWaitingKey} onReload={loadTeams}>
      <Teams {...props} {...headerActions} {...otherActions} />
    </Kb.Reloadable>
  )
}

const Connected = () => {
  const _teams = Container.useSelector(state => state.teams.teamMeta)
  const activityLevels = Constants.useState(s => s.activityLevels)
  const deletedTeams = Constants.useState(s => s.deletedTeams)
  const filter = Container.useSelector(state => state.teams.teamListFilter)
  const loaded = !Container.useAnyWaiting(Constants.teamsLoadedWaitingKey)
  const newTeamRequests = Container.useSelector(state => state.teams.newTeamRequests)
  const newTeams = Constants.useState(s => s.newTeams)
  const sawChatBanner = Container.useSelector(state => state.teams.sawChatBanner || false)
  const sortOrder = Container.useSelector(state => state.teams.teamListSort)
  const teamIDToResetUsers = Constants.useState(s => s.teamIDToResetUsers)
  const dispatch = Container.useDispatch()
  const onHideChatBanner = () => {
    dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawChatBanner'}))
  }
  const onOpenFolder = (teamname: Types.Teamname) => {
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`)))
  }
  const onReadMore = () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  }
  const props = {
    deletedTeams: deletedTeams,
    loaded: loaded,
    newTeamRequests: newTeamRequests,
    newTeams: newTeams,
    onHideChatBanner,
    onOpenFolder,
    onReadMore,
    sawChatBanner: sawChatBanner,
    teamresetusers: teamIDToResetUsers, // TODO remove when teamsRedesign flag removed
    teams: orderTeams(
      _teams,
      newTeamRequests,
      teamIDToResetUsers,
      newTeams,
      sortOrder,
      activityLevels,
      filter
    ),
  }
  return <Reloadable {...props} />
}

export default Connected
