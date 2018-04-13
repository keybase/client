// @flow
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import Team, {CustomComponent, type Props} from '.'
import {HeaderHoc} from '../../common-adapters'
import {branch, connect, lifecycle, compose, type TypedState} from '../../util/container'
import {navigateAppend} from '../../actions/route-tree'
import {anyWaiting} from '../../constants/waiting'
import {teamsTab} from '../../constants/tabs'
import {getOrderedMemberArray} from './member-row/helper'

// import {membersListItemsConnector} from './members/container'
// import {subteamsListItemsConnector} from './subteams/container'
// import {requestsAndInvitesListItemsConnector} from './invites/container'

const mapStateToProps = (state: TypedState, {routeProps, routeState}) => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }
  const yourOperations = Constants.getCanPerform(state, teamname)

  return {
    teamname,
    _memberInfo: Constants.getTeamMembers(state, teamname),
    // admin: yourOperations.manageMembers,
    // memberCount: Constants.getTeamMemberCount(state, teamname),
    // _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
    // numInvites: Constants.getTeamInvites(state, teamname).size,
    // numRequests: Constants.getTeamRequests(state, teamname).size,
    // numSubteams: Constants.getTeamSubteams(state, teamname).size,
    // loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
    // resetUserCount: Constants.getTeamResetUsers(state, teamname).size,
    selectedTab: routeState.get('selectedTab') || 'members',
    _yourOperations: yourOperations,
    _you: state.config.username || '',
    _invites: Constants.getTeamInvites(state, teamname),
    _requests: Constants.getTeamRequests(state, teamname),
  }
}

const mapDispatchToProps = (
  dispatch: Dispatch,
  {navigateUp, newOpenTeamRole, setOpenTeamRole, setRouteState, routeProps}
) => {
  return {
    _loadTeam: teamname => dispatch(TeamsGen.createGetDetails({teamname})),
    setSelectedTab: selectedTab => setRouteState({selectedTab}),
  }
  // const teamname = routeProps.get('teamname')
  // return {
  // onChat: () => dispatch(Chat2Gen.createStartConversation({tlf: `/keybase/team/${teamname}`})),
  // onBack: () => dispatch(navigateUp()),
  // onShowMenu: target =>
  // dispatch(
  // navigateAppend(
  // [
  // {
  // props: {
  // teamname,
  // position: 'bottom left',
  // targetRect: target && target.getBoundingClientRect(),
  // },
  // selected: 'menu',
  // },
  // ],
  // [teamsTab, 'team']
  // )
  // ),

  // onOpenFolder: () => dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  // }
}

const mergeProps = (stateProps, dispatchProps): Props => {
  // const customComponent = (
  // <CustomComponent
  // onOpenFolder={dispatchProps.onOpenFolder}
  // onChat={dispatchProps.onChat}
  // onShowMenu={dispatchProps.onShowMenu}
  // canChat={!stateProps.yourOperations.joinTeam}
  // canViewFolder={!stateProps.yourOperations.joinTeam}
  // />
  //
  // )
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
    case 'invites': {
      const requests = stateProps._requests.map(r => ({
        type: 'request',
        username: r.username,
      }))
      const invites = stateProps._invites.map(i => ({id: i.id, type: 'invite'}))
      tabSpecificRows = [
        ...requests,
        ...(requests.length ? [{type: 'divider'}] : []),
        ...invites,
        ...(invites.length ? [{type: 'divider'}] : []),
        ...(requests.length + invites.length === 0 ? [{type: 'none'}] : []),
      ]
    }
  }
  const rows = [{type: 'header'}, {type: 'tabs'}, ...tabSpecificRows]
  return {
    teamname: stateProps.teamname,
    _loadTeam: dispatchProps._loadTeam,
    // ...stateProps,
    // ...dispatchProps,
    rows,
    selectedTab: stateProps.selectedTab,
    setSelectedTab: dispatchProps.setSelectedTab,
    // customComponent,
    // newTeamRequests: stateProps._newTeamRequests.toArray(),
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
  // TODO remove these branches, let's not send all these props to all possible outcomes
  // branch(props => props.selectedTab === 'members', membersListItemsConnector),
  // // $FlowIssue passing extra props
  // branch(props => props.selectedTab === 'subteams', subteamsListItemsConnector),
  // branch(props => props.selectedTab === 'invites', requestsAndInvitesListItemsConnector),
  HeaderHoc
)(Team)
