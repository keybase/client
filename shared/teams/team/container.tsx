import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CustomTitle from './custom-title/container'
import {HeaderRightActions, HeaderTitle, SubHeader} from './nav-header/container'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import {useAllChannelMetas} from '../common/channel-hooks'
import Team, {Sections} from '.'
import makeRows from './rows'
import flags from '../../util/feature-flags'

type TabsStateOwnProps = Container.RouteProps<{teamID: Types.TeamID; initialTab?: Types.TabKey}>
type OwnProps = TabsStateOwnProps & {
  selectedTab: Types.TabKey
  setSelectedTab: (tab: Types.TabKey) => void
  channelMetas: Map<ChatTypes.ConversationIDKey, ChatTypes.ConversationMeta>
}

const defaultTab: Types.TabKey = 'members'

// keep track during session
const lastSelectedTabs = {}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamID = Container.getRouteProps(ownProps, 'teamID', '')
  if (!teamID) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }

  const selectedTab = ownProps.selectedTab || defaultTab

  return {
    invitesCollapsed: state.teams.invitesCollapsed,
    selectedTab,
    subteamsFiltered: state.teams.subteamsFiltered,
    teamDetails: Constants.getTeamDetails(state, teamID),
    teamID,
    teamMeta: Constants.getTeamMeta(state, teamID),
    yourOperations: Constants.getCanPerformByID(state, teamID),
    yourUsername: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const Connected = Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps: OwnProps) => {
    const rows = makeRows(
      stateProps.teamMeta,
      stateProps.teamDetails,
      stateProps.selectedTab,
      stateProps.yourUsername,
      stateProps.yourOperations,
      stateProps.invitesCollapsed,
      ownProps.channelMetas,
      stateProps.subteamsFiltered
    )
    const sections: Sections = [
      ...(Container.isMobile || flags.teamsRedesign
        ? [{data: [{key: 'header-inner', type: 'header' as const}], key: 'header'}]
        : []),
      {data: rows, header: {key: 'tabs', type: 'tabs'}, key: 'body'},
    ]
    const customComponent = <CustomTitle teamID={stateProps.teamID} />
    return {
      customComponent,
      onBack: dispatchProps.onBack,
      rows,
      sections,
      selectedTab: stateProps.selectedTab,
      setSelectedTab: ownProps.setSelectedTab,
      teamID: stateProps.teamID,
    }
  }),
  flags.teamsRedesign ? a => a : Kb.HeaderHoc
)(Team) as any

const TabsState = (props: TabsStateOwnProps) => {
  const teamID = Container.getRouteProps(props, 'teamID', '')
  const initialTab = Container.getRouteProps(props, 'initialTab', undefined)

  const defaultSelectedTab = initialTab ?? lastSelectedTabs[teamID] ?? 'members'
  const [selectedTab, _setSelectedTab] = React.useState<Types.TabKey>(defaultSelectedTab)
  const setSelectedTab = React.useCallback(
    selectedTab => {
      lastSelectedTabs[teamID] = selectedTab
      _setSelectedTab(selectedTab)
    },
    [teamID, _setSelectedTab]
  )

  const prevTeamID = Container.usePrevious(teamID)
  React.useEffect(() => {
    if (teamID !== prevTeamID) {
      setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, prevTeamID, setSelectedTab, defaultSelectedTab])

  // Only available as hook, TODO refactor this whole thing in Y2K-1571
  const dontCallRPC = selectedTab !== 'channels'
  const channelMetas = useAllChannelMetas(teamID, dontCallRPC)

  return (
    <Connected
      {...props}
      setSelectedTab={setSelectedTab}
      selectedTab={selectedTab}
      channelMetas={channelMetas}
    />
  )
}

const newNavigationOptions = () => ({
  headerHideBorder: true,
})

// TODO: hide the tab bar when the selection popup is present on mobile
TabsState.navigationOptions = flags.teamsRedesign
  ? newNavigationOptions
  : (ownProps: TabsStateOwnProps) => ({
      header: null,
      headerExpandable: true,
      headerHideBorder: true,
      headerRightActions: Container.isMobile
        ? undefined
        : () => <HeaderRightActions teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
      headerTitle: Container.isMobile
        ? undefined
        : () => <HeaderTitle teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
      subHeader: Container.isMobile
        ? undefined
        : () => <SubHeader teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
    })

export default TabsState
export type TeamScreenType = React.ComponentType<TabsStateOwnProps>
