import * as Constants from '../../../constants/teams'
import * as I from 'immutable'
import * as Types from '../../../constants/types/teams'
import Tabs from '.'
import {connect} from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  teamname: string
  selectedTab: string
  setSelectedTab: (arg0: Types.TabKey) => void
}

const mapStateToProps = (state, {teamname, selectedTab, setSelectedTab}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
    admin: yourOperations.manageMembers,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname), Constants.teamTarsWaitingKey(teamname)),
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

const mapDispatchToProps = () => ({})

const mergeProps = (stateProps, _, __: OwnProps) => {
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

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Tabs)
