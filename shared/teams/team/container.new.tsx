import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CustomTitle from './custom-title/container'
import {HeaderTitle, SubHeader} from './nav-header/container.new'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import Team, {Sections} from '.'
import makeRows from './rows'

type TabsStateOwnProps = Container.RouteProps<{teamID: Types.TeamID}>
type OwnProps = TabsStateOwnProps & {
  selectedTab: Types.TabKey
  setSelectedTab: (tab: Types.TabKey) => void
}

// keep track during session
const lastSelectedTabs = {}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamID = Container.getRouteProps(ownProps, 'teamID', '')
  if (!teamID) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }

  const selectedTab = ownProps.selectedTab || 'members'

  return {
    invitesCollapsed: state.teams.invitesCollapsed,
    selectedTab,
    teamDetails: Constants.getTeamDetails(state, teamID),
    teamID,
    yourOperations: Constants.getCanPerformByID(state, teamID),
    yourUsername: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const Connected = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const rows = makeRows(
      stateProps.teamDetails,
      stateProps.selectedTab,
      stateProps.yourUsername,
      stateProps.yourOperations,
      stateProps.invitesCollapsed
    )
    const sections: Sections = [{data: rows, header: {key: 'tabs', type: 'tabs'}, key: 'body'}]
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
  }
)(Team)

class TabsState extends React.PureComponent<TabsStateOwnProps, {selectedTab: Types.TabKey}> {
  static navigationOptions = (ownProps: TabsStateOwnProps) => ({
    header: Container.isMobile
      ? () => <HeaderTitle teamID={Container.getRouteProps(ownProps, 'teamID', '')} />
      : undefined,
    headerExpandable: true,
    headerHideBorder: true,
    headerTitle: () => <HeaderTitle teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
    subHeader: () => <SubHeader teamID={Container.getRouteProps(ownProps, 'teamID', '')} />,
  })
  state = {selectedTab: lastSelectedTabs[Container.getRouteProps(this.props, 'teamID', '')] || 'members'}
  private setSelectedTab = selectedTab => {
    lastSelectedTabs[Container.getRouteProps(this.props, 'teamID', '')] = selectedTab
    this.setState({selectedTab})
  }
  componentDidUpdate(prevProps: TabsStateOwnProps) {
    const teamID = Container.getRouteProps(this.props, 'teamID', '')
    if (teamID !== Container.getRouteProps(prevProps, 'teamID', '')) {
      this.setSelectedTab(lastSelectedTabs[teamID] || 'members')
    }
  }
  render() {
    return (
      <Connected {...this.props} setSelectedTab={this.setSelectedTab} selectedTab={this.state.selectedTab} />
    )
  }
}

export default TabsState
