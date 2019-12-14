import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import Teams, {OwnProps as MainOwnProps} from './main'
import {HeaderRightActions} from './main/header'
import openURL from '../util/open-url'
import * as Constants from '../constants/teams'
import * as WaitingConstants from '../constants/waiting'
import * as Types from '../constants/types/teams'
import {memoize} from '../util/memoize'
import {useTeamsSubscribe} from './subscriber'

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
    onCreateTeam: () => {
      dispatch(
        nav.safeNavigateAppendPayload({
          path: ['teamNewTeamDialog'],
        })
      )
    },
    onJoinTeam: () => {
      dispatch(nav.safeNavigateAppendPayload({path: ['teamJoinTeamDialog']}))
    },
  }
}

const orderTeams = memoize((teams: Types.State['teamDetails']) =>
  [...teams.values()].sort((a, b) => a.teamname.localeCompare(b.teamname))
)

type ReloadableProps = Omit<MainOwnProps, 'onManageChat' | 'onViewTeam'>

const Reloadable = (
  props: ReloadableProps & {
    loadTeams: () => void
    onClearBadges: () => void
  }
) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => () => props.onClearBadges(), [])
  // subscribe to teams changes
  useTeamsSubscribe()
  const {loadTeams, onClearBadges, ...rest} = props
  const headerActions = useHeaderActions()

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const otherActions = {
    onManageChat: (teamname: Types.Teamname) =>
      dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamname}, selected: 'chatManageChannels'}]})),
    onViewTeam: (teamID: Types.TeamID) =>
      dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]})),
  }

  return (
    <Kb.Reloadable waitingKeys={Constants.teamsLoadedWaitingKey} onReload={loadTeams}>
      <Teams {...rest} {...headerActions} {...otherActions} />
    </Kb.Reloadable>
  )
}
Reloadable.navigationOptions = {
  header: undefined,
  headerRightActions: () => <ConnectedHeaderRightActions />,
  title: 'Teams',
}

const Connected = Container.connect(
  (state: Container.TypedState) => ({
    _teamresetusers: state.teams.teamNameToResetUsers || new Map(),
    _teams: state.teams.teamDetails,
    deletedTeams: state.teams.deletedTeams,
    loaded: !WaitingConstants.anyWaiting(state, Constants.teamsLoadedWaitingKey),
    newTeamRequests: state.teams.newTeamRequests,
    newTeams: state.teams.newTeams,
    sawChatBanner: state.teams.sawChatBanner || false,
  }),
  (dispatch: Container.TypedDispatch) => ({
    loadTeams: () => dispatch(TeamsGen.createGetTeams()),
    onClearBadges: () => dispatch(TeamsGen.createClearNavBadges()),
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
    teamresetusers: stateProps._teamresetusers,
    teams: orderTeams(stateProps._teams),
    ...dispatchProps,
  })
)(Reloadable)

const ConnectedHeaderRightActions = (_: {}) => {
  const actions = useHeaderActions()
  return <HeaderRightActions {...actions} />
}

export default Connected
