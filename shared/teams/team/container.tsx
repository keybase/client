import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Team, {Props} from '.'
import CustomTitle from './custom-title/container'
import {HeaderRightActions, HeaderTitle, SubHeader} from './nav-header/container'
import * as Kb from '../../common-adapters'
import {connect, compose, getRouteProps, isMobile} from '../../util/container'
import * as Constants from '../../constants/teams'
import {mapStateHelper as invitesMapStateHelper, getRows as getInviteRows} from './invites-tab/helper'
import {mapStateHelper as memberMapStateHelper, getRows as getMemberRows} from './members-tab/helper'
import {mapStateHelper as subteamsMapStateHelper, getRows as getSubteamsRows} from './subteams-tab/helper'
import {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    teamname: string
  },
  {}
> & {
  selectedTab: string
  setSelectedTab: (arg0: string) => void
}

// keep track during session
const lastSelectedTabs = {}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const teamname = getRouteProps(ownProps, 'teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }

  const selectedTab = ownProps.selectedTab || 'members'

  return {
    ...(selectedTab === 'members' ? memberMapStateHelper(state, {teamname}) : {}),
    ...(selectedTab === 'invites' ? invitesMapStateHelper(state, {teamname}) : {}),
    ...(selectedTab === 'subteams' ? subteamsMapStateHelper(state, {teamname}) : {}),
    selectedTab,
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {setSelectedTab}: OwnProps) => ({
  _loadTeam: (teamname: string) => dispatch(TeamsGen.createGetDetails({teamname})),
  _setSelectedTab: (teamname: string, selectedTab: string) => {
    lastSelectedTabs[teamname] = selectedTab
    setSelectedTab(selectedTab)
  },
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => {
  let tabSpecificRows = []
  switch (stateProps.selectedTab) {
    case 'members':
      tabSpecificRows = getMemberRows(stateProps)
      break
    case 'invites':
      tabSpecificRows = getInviteRows(stateProps)
      break
    case 'subteams':
      tabSpecificRows = getSubteamsRows(stateProps)
      break
    case 'settings':
      tabSpecificRows = [{type: 'settings'}]
      break
  }
  const rows = [...(!isMobile ? [] : [{type: 'header'}]), {type: 'tabs'}, ...tabSpecificRows]
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
}

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

type State = {
  selectedTab: string
}

// We don't use route state anymore
class TabsState extends React.PureComponent<Props, State> {
  static navigationOptions = ({navigation}: {navigation: any}) => ({
    headerExpandable: true,
    headerHideBorder: true,
    headerRightActions: isMobile
      ? undefined
      : () => <HeaderRightActions teamname={navigation.getParam('teamname')} />,
    headerTitle: isMobile ? undefined : () => <HeaderTitle teamname={navigation.getParam('teamname')} />,
    subHeader: isMobile ? undefined : () => <SubHeader teamname={navigation.getParam('teamname')} />,
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

const Connected = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Kb.HeaderHoc
)(Reloadable) as any

export default TabsState
