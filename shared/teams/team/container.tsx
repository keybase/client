import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Team, {Props} from '.'
import CustomTitle from './custom-title/container'
import {HeaderRightActions, HeaderTitle, SubHeader} from './nav-header/container'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {mapStateHelper as invitesMapStateHelper, getRows as getInviteRows} from './invites-tab/helper'
import {mapStateHelper as memberMapStateHelper, getRows as getMemberRows} from './members-tab/helper'
import {mapStateHelper as subteamsMapStateHelper, getRows as getSubteamsRows} from './subteams-tab/helper'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}> & {
  selectedTab: string
  setSelectedTab: (arg0: string) => void
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
    teamDetails: Constants.getTeamDetails(state, teamID),
    selectedTab,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {setSelectedTab}: OwnProps) => ({
  _loadTeam: (teamname: string) => dispatch(TeamsGen.createGetDetails({teamname})),
  _setSelectedTab: (teamname: string, selectedTab: string) => {
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
          rows={this.props.rows}
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
    let tabSpecificRows: Array<any> = []
    switch (stateProps.selectedTab) {
      case 'members':
        tabSpecificRows = getMemberRows({
          // @ts-ignore don't mash these together
          _memberInfo: stateProps._memberInfo,
          // @ts-ignore don't mash these together
          _you: stateProps._you,
          // @ts-ignore don't mash these together
          _yourOperations: stateProps._yourOperations,
        })
        break
      case 'invites':
        tabSpecificRows = getInviteRows({
          // @ts-ignore don't mash these together
          _invites: stateProps._invites,
          // @ts-ignore don't mash these together
          _requests: stateProps._requests,
        })
        break
      case 'subteams':
        tabSpecificRows = getSubteamsRows({
          // @ts-ignore don't mash these together
          _sawSubteamsBanner: stateProps._sawSubteamsBanner,
          // @ts-ignore don't mash these together
          _subteams: stateProps._subteams,
          // @ts-ignore don't mash these together
          _yourOperations: stateProps._yourOperations,
        })
        break
      case 'settings':
        tabSpecificRows = [{type: 'settings'}]
        break
    }
    const rows = [...(!Container.isMobile ? [] : [{type: 'header'}]), {type: 'tabs'}, ...tabSpecificRows]
    const customComponent = <CustomTitle teamname={stateProps.teamname} />
    return {
      _load: () => dispatchProps._loadTeam(stateProps.teamname),
      customComponent,
      onBack: dispatchProps.onBack,
      rows,
      selectedTab: stateProps.selectedTab,
      setSelectedTab: selectedTab => dispatchProps._setSelectedTab(stateProps.teamname, selectedTab),
      teamname: stateProps.teamname,
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
