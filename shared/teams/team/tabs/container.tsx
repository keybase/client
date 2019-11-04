import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import Tabs from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  teamname: string
  selectedTab: string
  setSelectedTab: (tab: Types.TabKey) => void
}

export default Container.connect(
  (state, {teamname, selectedTab, setSelectedTab}: OwnProps) => {
    const yourOperations = Constants.getCanPerform(state, teamname)
    return {
      admin: yourOperations.manageMembers,
      loading: anyWaiting(state, Constants.teamWaitingKey(teamname), Constants.teamTarsWaitingKey(teamname)),
      memberCount: Constants.getTeamMemberCount(state, teamname),
      newTeamRequestsByName: state.teams.newTeamRequestsByName,
      numInvites: Constants.getTeamInvites(state, teamname).size,
      numRequests: Constants.getTeamRequests(state, teamname).size,
      numSubteams: Constants.getTeamSubteams(state, teamname).size,
      resetUserCount: Constants.getTeamResetUsers(state, teamname).size,
      selectedTab,
      setSelectedTab,
      teamname,
      yourOperations,
    }
  },
  () => ({}),
  (stateProps, _, __) => {
    return {
      admin: stateProps.admin,
      loading: stateProps.loading,
      memberCount: stateProps.memberCount,
      newRequests: stateProps.newTeamRequestsByName.get(stateProps.teamname) || 0,
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
)(Tabs)
