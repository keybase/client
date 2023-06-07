import * as Constants from '../../../constants/teams'
import type * as Types from '../../../constants/types/teams'
import Tabs from '.'
import * as Container from '../../../util/container'

type OwnProps = {
  teamID: Types.TeamID
  selectedTab: Types.TabKey
  setSelectedTab: (tab: Types.TabKey) => void
}

export default (ownProps: OwnProps) => {
  const {selectedTab, setSelectedTab, teamID} = ownProps
  const teamMeta = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const teamDetails = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const yourOperations = Container.useSelector(state => Constants.getCanPerformByID(state, teamID))

  const admin = yourOperations.manageMembers
  const error = Container.useSelector(state => state.teams.errorInAddToTeam)
  const isBig = Container.useSelector(state => Constants.isBigTeam(state, teamID))
  const loading = Container.useAnyWaiting([
    Constants.teamWaitingKey(teamID),
    Constants.teamTarsWaitingKey(teamMeta.teamname),
  ])
  const newTeamRequests = Container.useSelector(state => state.teams.newTeamRequests)
  const numInvites = teamDetails.invites?.size ?? 0
  const numRequests = teamDetails.requests?.size ?? 0
  const numSubteams = teamDetails.subteams?.size ?? 0
  const resetUserCount = Container.useSelector(
    state => Constants.getTeamResetUsers(state, teamMeta.teamname).size
  )
  const showSubteams = yourOperations.manageSubteams
  const props = {
    admin: admin,
    error: error,
    isBig: isBig,
    loading: loading,
    newRequests: newTeamRequests.get(ownProps.teamID)?.size ?? 0,
    numInvites: numInvites,
    numRequests: numRequests,
    numSubteams: numSubteams,
    resetUserCount: resetUserCount,
    selectedTab: selectedTab,
    setSelectedTab: setSelectedTab,
    showSubteams: showSubteams,
  }
  return <Tabs {...props} />
}
