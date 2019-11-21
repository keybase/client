import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import Tabs from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  teamID: Types.TeamID
  selectedTab: string
  setSelectedTab: (tab: Types.TabKey) => void
}

export default Container.connect(
  (state, {teamID, selectedTab, setSelectedTab}: OwnProps) => {
    const teamDetails = Constants.getTeamDetails(state, teamID)
    const yourOperations = Constants.getCanPerformByID(state, teamID)
    return {
      admin: yourOperations.manageMembers,
      loading: anyWaiting(
        state,
        Constants.teamWaitingKey(teamDetails.teamname),
        Constants.teamTarsWaitingKey(teamDetails.teamname)
      ),
      memberCount: teamDetails.memberCount,
      newTeamRequestsByName: state.teams.newTeamRequestsByName,
      numInvites: teamDetails.invites?.size ?? 0,
      numRequests: teamDetails.requests?.size ?? 0,
      numSubteams: teamDetails.subteams?.size ?? 0,
      resetUserCount: Constants.getTeamResetUsers(state, teamDetails.teamname).size,
      selectedTab,
      setSelectedTab,
      showSubteams: yourOperations.manageSubteams,
      teamname: teamDetails.teamname,
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
      showSubteams: stateProps.showSubteams,
    }
  }
)(Tabs)
