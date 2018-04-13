// @flow
import * as Constants from '../../../constants/teams'
import * as I from 'immutable'
// import * as React from 'react'
// import * as TeamsGen from '../../actions/teams-gen'
// import * as KBFSGen from '../../actions/kbfs-gen'
// import * as Chat2Gen from '../../actions/chat2-gen'
import Tabs from '.'
import {connect, type TypedState} from '../../../util/container'
// import {navigateAppend} from '../../actions/route-tree'
import {anyWaiting} from '../../../constants/waiting'
// import {teamsTab} from '../../constants/tabs'

const mapStateToProps = (state: TypedState, {teamname, selectedTab, setSelectedTab}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
    admin: yourOperations.manageMembers,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
    memberCount: Constants.getTeamMemberCount(state, teamname),
    numInvites: Constants.getTeamInvites(state, teamname).size,
    numRequests: Constants.getTeamRequests(state, teamname).size,
    numSubteams: Constants.getTeamSubteams(state, teamname).size,
    resetUserCount: Constants.getTeamResetUsers(state, teamname).size,
    selectedTab,
    setSelectedTab,
    teamname,
    yourOperations,
  }
}

const mapDispatchToProps = (
  dispatch: Dispatch
  // {navigateUp, newOpenTeamRole, setOpenTeamRole, setRouteState, routeProps}
) => {
  return {}
  // const teamname = routeProps.get('teamname')
  // return {
  // setSelectedTab: selectedTab => setRouteState({selectedTab}),
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
  return {
    admin: stateProps.admin,
    loading: stateProps.loading,
    memberCount: stateProps.memberCount,
    newTeamRequests: stateProps._newTeamRequests.toArray(),
    numInvites: stateProps.numInvites,
    numRequests: stateProps.numRequests,
    numSubteams: stateProps.numSubteams,
    resetUserCount: stateProps.resetUserCount,
    selectedTab: stateProps.selectedTab,
    setSelectedTab: stateProps.setSelectedTab,
    teamname: stateProps.teamname,
    yourOperations: stateProps.yourOperations,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Tabs)
