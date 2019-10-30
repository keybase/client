import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CustomTitle from './custom-title/container'
import {HeaderRightActions, HeaderTitle, SubHeader} from './nav-header/container'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import Team, {Props, Sections} from '.'
import makeRows from './rows'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}> & {
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
    _teamnameTodoRemove: Constants.getTeamDetails(state, teamID).teamname,
    selectedTab,
    teamDetails: Constants.getTeamDetails(state, teamID),
    yourOperations: Constants.getCanPerformByID(state, teamID),
    yourUsername: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {setSelectedTab}: OwnProps) => ({
  _loadTeam: (teamname: string) => dispatch(TeamsGen.createGetDetails({teamname})),
  _setSelectedTab: (teamname: string, selectedTab: Types.TabKey) => {
    lastSelectedTabs[teamname] = selectedTab
    setSelectedTab(selectedTab)
  },
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

// TODO move into index
class Reloadable extends React.PureComponent<Props & {_load: () => void}> {
  componentDidUpdate(prevProps) {
    if (this.props.teamname !== prevProps.teamname) {
      this.props._load()
      this.props.setSelectedTab(lastSelectedTabs[this.props.teamname] || 'members')
    }
  }

  render() {
    return (
      <Kb.Reloadable
        waitingKeys={Constants.teamGetWaitingKey(this.props.teamname)}
        onReload={this.props._load}
        reloadOnMount={true}
      >
        <Team
          sections={this.props.sections}
          selectedTab={this.props.selectedTab}
          setSelectedTab={this.props.setSelectedTab}
          teamname={this.props.teamname}
        />
      </Kb.Reloadable>
    )
  }
}

const Connected = Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => {
    const rows = makeRows(
      stateProps.teamDetails,
      stateProps.selectedTab,
      stateProps.yourUsername,
      stateProps.yourOperations
    )
    const sections: Sections = [
      ...(Container.isMobile ? [{data: [{type: 'header' as const}], key: 'header'}] : []),
      {data: rows, header: {type: 'tabs'}, key: 'body'},
    ]
    const customComponent = <CustomTitle teamname={stateProps._teamnameTodoRemove} />
    return {
      _load: () => dispatchProps._loadTeam(stateProps._teamnameTodoRemove),
      customComponent,
      onBack: dispatchProps.onBack,
      rows,
      sections,
      selectedTab: stateProps.selectedTab,
      setSelectedTab: selectedTab =>
        dispatchProps._setSelectedTab(stateProps._teamnameTodoRemove, selectedTab),
      teamname: stateProps._teamnameTodoRemove,
    }
  }),
  Kb.HeaderHoc
)(Reloadable) as any

class TabsState extends React.PureComponent<Props, {selectedTab: string}> {
  static navigationOptions = (ownProps: Container.RouteProps<{teamname: string}>) => ({
    headerExpandable: true,
    headerHideBorder: true,
    headerRightActions: Container.isMobile
      ? undefined
      : () => <HeaderRightActions teamname={Container.getRouteProps(ownProps, 'teamname', '')} />,
    headerTitle: Container.isMobile
      ? undefined
      : () => <HeaderTitle teamname={Container.getRouteProps(ownProps, 'teamname', '')} />,
    subHeader: Container.isMobile
      ? undefined
      : () => <SubHeader teamname={Container.getRouteProps(ownProps, 'teamname', '')} />,
  })
  state = {selectedTab: lastSelectedTabs[this.props.teamname]}
  _setSelectedTab = selectedTab => {
    this.setState({selectedTab})
  }
  render() {
    return (
      <Connected {...this.props} setSelectedTab={this._setSelectedTab} selectedTab={this.state.selectedTab} />
    )
  }
}

export default TabsState
