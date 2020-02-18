import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderRightActions, HeaderTitle, SubHeader} from './nav-header/container'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import {TabKey} from './tabs'
import Channel, {Sections, TabProps} from '.'
import makeRows from './rows'
import flags from '../../util/feature-flags'

type RouteProps = Container.RouteProps<{teamID: Types.TeamID; conversationIDKey: ChatTypes.ConversationIDKey}>
type OwnProps = TabProps & RouteProps

// keep track during session
const lastSelectedTabs: {[T: string]: TabKey} = {}
const defaultTab: TabKey = 'members'

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamID = Container.getRouteProps(ownProps, 'teamID', '')
  const conversationIDKey = Container.getRouteProps(ownProps, 'conversationIDKey', '')
  if (!teamID) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }

  return {
    _channelInfo:
      state.teams.teamIDToChannelInfos.get(teamID)?.get(conversationIDKey) ?? Constants.initialChannelInfo,
    _teamMembers: Constants.getTeamDetails(state, teamID).members,
    _yourOperations: Constants.getCanPerformByID(state, teamID),
    _yourUsername: state.config.username,
    conversationIDKey,
    teamID,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const ConnectedChannel = Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps) => {
    const rows = makeRows(
      stateProps._channelInfo,
      stateProps._teamMembers,
      ownProps.selectedTab,
      stateProps._yourOperations
    )
    const sections: Sections = [
      ...(Container.isMobile && !flags.teamsRedesign
        ? [{data: [{key: 'header-inner', type: 'header' as const}], key: 'header'}]
        : []),
      {data: rows, header: {key: 'tabs', type: 'tabs'}, key: 'body'},
    ]
    return {
      onBack: dispatchProps.onBack,
      rows,
      sections,
      teamID: stateProps.teamID,
    }
  }),
  Kb.HeaderHoc
)(Channel) as any

// Maintains the tab state.
// Unfortunately this has to be in the container because it's interleaved with
// connected state while providing its props to downstream components.
const ConnectedChannelWithTabs = (props: RouteProps) => {
  const teamID = Container.getRouteProps(props, 'teamID', '')
  const defaultSelectedTab = lastSelectedTabs[teamID] ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<TabKey>(defaultSelectedTab)
  const setSelectedTab = React.useCallback(
    t => {
      lastSelectedTabs[teamID] = t
      _setSelectedTab(t)
    },
    [teamID, _setSelectedTab]
  )
  const prevTeamID = Container.usePrevious(teamID)
  const prevSelectedTab = Container.usePrevious(selectedTab)
  const dispatch = Container.useDispatch()

  React.useEffect(() => {
    if (teamID !== prevTeamID) {
      setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, prevTeamID, setSelectedTab, defaultSelectedTab])

  React.useEffect(() => {
    if (selectedTab !== prevSelectedTab && selectedTab === 'bots') {
      // TODO: load bots here
    }
  }, [selectedTab, dispatch, teamID, prevSelectedTab])

  return <ConnectedChannel {...props} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
}

ConnectedChannelWithTabs.navigationOptions = (ownProps: RouteProps) => ({
  header: Container.isMobile
    ? () => <HeaderTitle teamID={Container.getRouteProps(ownProps, 'teamID', '')} />
    : null,
  headerExpandable: true,
  headerHideBorder: true,
  headerTitle: Container.isMobile
    ? undefined
    : () => <HeaderTitle teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
  subHeader: () => <SubHeader teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
})

export default ConnectedChannelWithTabs
export type ChannelScreenType = React.ComponentType<OwnProps>
