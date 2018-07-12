// @flow
import * as Constants from '../../../constants/teams'
import * as I from 'immutable'
import Tabs from '.'
import {connect, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState, {teamname, selectedTab, setSelectedTab}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
    admin: yourOperations.manageMembers,
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

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    admin: stateProps.admin,
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
