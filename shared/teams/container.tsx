import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import * as Styles from '../styles'
import Teams, {type OwnProps as MainOwnProps} from './main'
import {HeaderRightActions} from './main/header'
import openURL from '../util/open-url'
import * as Constants from '../constants/teams'
import * as WaitingConstants from '../constants/waiting'
import type * as Types from '../constants/types/teams'
import {memoize} from '../util/memoize'
import {useTeamsSubscribe} from './subscriber'
import {useActivityLevels} from './common'

type OwnProps = {}

// share some between headerRightActions on desktop and component on mobile
type HeaderActionProps = {
  onCreateTeam: () => void
  onJoinTeam: () => void
}
const useHeaderActions = (): HeaderActionProps => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  return {
    onCreateTeam: () => dispatch(TeamsGen.createLaunchNewTeamWizardOrModal()),
    onJoinTeam: () => dispatch(nav.safeNavigateAppendPayload({path: ['teamJoinTeamDialog']})),
  }
}

const orderTeamsImpl = (
  teams: Map<string, Types.TeamMeta>,
  newRequests: Types.State['newTeamRequests'],
  teamIDToResetUsers: Types.State['teamIDToResetUsers'],
  newTeams: Types.State['newTeams'],
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

const TeamsFilter = () => {
  const dispatch = Container.useDispatch()
  const filterValue = Container.useSelector(s => s.teams.teamListFilter)
  const numTeams = Container.useSelector(s => s.teams.teamMeta.size)
  const setFilter = (filter: string) => dispatch(TeamsGen.createSetTeamListFilterSort({filter}))
  return numTeams >= 20 ? (
    <Kb.SearchFilter
      value={filterValue}
      valueControlled={true}
      onChange={setFilter}
      size="small"
      placeholderText="Filter"
      hotkey="k"
      icon="iconfont-filter"
      style={filterStyles.filter}
    />
  ) : null
}
const filterStyles = Styles.styleSheetCreate(() => ({
  filter: {
    alignSelf: 'flex-end',
    marginBottom: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xsmall,
  },
}))

Reloadable.navigationOptions = {
  headerRightActions: !Styles.isMobile ? () => <TeamsFilter /> : () => <ConnectedHeaderRightActions />,
  title: 'Teams',
}

const Connected = Container.connect(
  (state: Container.TypedState) => ({
    _teams: state.teams.teamMeta,
    activityLevels: state.teams.activityLevels,
    deletedTeams: state.teams.deletedTeams,
    filter: state.teams.teamListFilter,
    loaded: !WaitingConstants.anyWaiting(state, Constants.teamsLoadedWaitingKey),
    newTeamRequests: state.teams.newTeamRequests,
    newTeams: state.teams.newTeams,
    sawChatBanner: state.teams.sawChatBanner || false,
    sortOrder: state.teams.teamListSort,
    teamIDToResetUsers: state.teams.teamIDToResetUsers,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onHideChatBanner: () =>
      dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawChatBanner'})),
    onOpenFolder: (teamname: Types.Teamname) =>
      dispatch(
        FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))
      ),
    onReadMore: () => {
      openURL('https://keybase.io/blog/introducing-keybase-teams')
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    deletedTeams: stateProps.deletedTeams,
    loaded: stateProps.loaded,
    newTeamRequests: stateProps.newTeamRequests,
    newTeams: stateProps.newTeams,
    sawChatBanner: stateProps.sawChatBanner,
    teamresetusers: stateProps.teamIDToResetUsers, // TODO remove when teamsRedesign flag removed
    teams: orderTeams(
      stateProps._teams,
      stateProps.newTeamRequests,
      stateProps.teamIDToResetUsers,
      stateProps.newTeams,
      stateProps.sortOrder,
      stateProps.activityLevels,
      stateProps.filter
    ),
    ...dispatchProps,
  })
)(Reloadable)

const ConnectedHeaderRightActions = (_: {}) => {
  const actions = useHeaderActions()
  return <HeaderRightActions {...actions} />
}

export default Connected
