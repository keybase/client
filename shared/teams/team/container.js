// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'
import Team from '.'
import CustomTitle from './custom-title/container'
import {HeaderHoc} from '../../common-adapters'
import {connect, lifecycle, compose, type TypedState} from '../../util/container'
import {getOrderedMemberArray} from './member-row/helper'

const mapStateToProps = (state: TypedState, {routeProps, routeState}) => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }
  const yourOperations = Constants.getCanPerform(state, teamname)

  return {
    _invites: Constants.getTeamInvites(state, teamname),
    _memberInfo: Constants.getTeamMembers(state, teamname),
    _requests: Constants.getTeamRequests(state, teamname),
    _subteams: Constants.getTeamSubteams(state, teamname),
    _you: state.config.username || '',
    _yourOperations: yourOperations,
    sawSubteamsBanner: state.teams.getIn(['sawSubteamsBanner'], false),
    selectedTab: routeState.get('selectedTab') || 'members',
    teamname,
  }
}

const mapDispatchToProps = (
  dispatch: Dispatch,
  {navigateUp, newOpenTeamRole, setOpenTeamRole, setRouteState, routeProps}
) => {
  return {
    _loadTeam: teamname => dispatch(TeamsGen.createGetDetails({teamname})),
    onBack: () => dispatch(navigateUp()),
    setSelectedTab: selectedTab => setRouteState({selectedTab}),
  }
}

const mergeProps = (stateProps, dispatchProps): Props => {
  let tabSpecificRows = []
  switch (stateProps.selectedTab) {
    case 'members':
      tabSpecificRows = getOrderedMemberArray(
        stateProps._memberInfo,
        stateProps._you,
        stateProps._yourOperations
      ).map(i => ({
        type: 'member',
        username: i.username,
      }))
      break
    case 'invites':
      {
        const requests = stateProps._requests.map(r => ({
          type: 'request',
          username: r.username,
        }))
        const invites = stateProps._invites.map(i => ({id: i.id, type: 'invite'}))
        tabSpecificRows = [
          ...(requests.size ? [{label: 'Requests', type: 'divider'}] : []),
          ...requests,
          ...(invites.size ? [{label: 'Invites', type: 'divider'}] : []),
          ...invites,
          ...(requests.size + invites.size === 0 ? [{type: 'none'}] : []),
        ]
      }
      break
    case 'subteams':
      {
        const subteams = stateProps._subteams.sort()
        const noSubteams = subteams.isEmpty()
        tabSpecificRows = [
          ...(!stateProps.sawSubteamsBanner ? [{type: 'subteam-intro'}] : []),
          ...(stateProps._yourOperations.manageSubteams ? [{type: 'subteam-add'}] : []),
          ...subteams.map(subteam => ({teamname: subteam, type: 'subteam-subteam'})),
          ...(noSubteams ? [{type: 'subteam-none'}] : []),
        ]
      }
      break
    case 'settings':
      tabSpecificRows = [{type: 'settings'}]
      break
  }
  const rows = [{type: 'header'}, {type: 'tabs'}, ...tabSpecificRows]
  const customComponent = <CustomTitle teamname={stateProps.teamname} />
  return {
    _loadTeam: dispatchProps._loadTeam,
    customComponent,
    onBack: dispatchProps.onBack,
    rows,
    selectedTab: stateProps.selectedTab,
    setSelectedTab: dispatchProps.setSelectedTab,
    teamname: stateProps.teamname,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props._loadTeam(this.props.teamname)
    },
    componentDidUpdate(prevProps) {
      if (this.props.teamname !== prevProps.teamname) {
        this.props._loadTeam(this.props.teamname)
        this.props.setSelectedTab('members')
      }
    },
  }),
  HeaderHoc
)(Team)
