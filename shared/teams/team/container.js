// @flow
import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import Team from '.'
import CustomTitle from './custom-title/container'
import {HeaderRightActions, HeaderTitle} from './nav-header/container'
import * as Kb from '../../common-adapters'
import {connect, compose, isMobile} from '../../util/container'
import * as Constants from '../../constants/teams'
import {mapStateHelper as invitesMapStateHelper, getRows as getInviteRows} from './invites-tab/helper'
import {mapStateHelper as memberMapStateHelper, getRows as getMemberRows} from './members-tab/helper'
import {mapStateHelper as subteamsMapStateHelper, getRows as getSubteamsRows} from './subteams-tab/helper'
import type {RouteProps} from '../../route-tree/render-route'
import flags from '../../util/feature-flags'

// $FlowIssue
type OwnProps = RouteProps<{teamname: string}, {}> & {selectedTab: string, setSelectedTab: string => void}

// keep track during session
const lastSelectedTabs = {}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const teamname = ownProps.routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }

  const selectedTab = ownProps.selectedTab || lastSelectedTabs[teamname] || 'members'

  return {
    ...(selectedTab === 'members' ? memberMapStateHelper(state, {teamname}) : {}),
    ...(selectedTab === 'invites' ? invitesMapStateHelper(state, {teamname}) : {}),
    ...(selectedTab === 'subteams' ? subteamsMapStateHelper(state, {teamname}) : {}),
    selectedTab,
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps, setSelectedTab}: OwnProps) => ({
  _loadTeam: (teamname: string) => dispatch(TeamsGen.createGetDetails({teamname})),
  _setSelectedTab: (teamname: string, selectedTab: string) => {
    lastSelectedTabs[teamname] = selectedTab
    setSelectedTab(selectedTab)
  },
  onBack: () => dispatch(navigateUp()),
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
  const rows = [
    ...(flags.useNewRouter && !isMobile ? [] : [{type: 'header'}]),
    {type: 'tabs'},
    ...tabSpecificRows,
  ]
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

class Reloadable extends React.PureComponent<{
  ...React.ElementConfig<typeof Team>,
  ...{|_load: () => void|},
}> {
  componentDidUpdate(prevProps) {
    if (this.props.teamname !== prevProps.teamname) {
      this.props._load()
      this.props.setSelectedTab('members')
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

type NavigationParams = {
  params: {
    teamname: string,
  },
}

type State = {|selectedTab: string|}

// We don't use route state anymore
class TabsState extends React.PureComponent<React.ElementConfig<typeof Team>, State> {
  static navigationOptions = {
    header: undefined,
    headerHideBorder: true,
    headerRightActions: ({params}: NavigationParams) => <HeaderRightActions teamname={params.teamname} />,
    headerTitle: ({params}: NavigationParams) => <HeaderTitle teamname={params.teamname} />,
  }
  state = {selectedTab: 'members'}
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
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Kb.HeaderHoc
)(Reloadable)

export default TabsState
