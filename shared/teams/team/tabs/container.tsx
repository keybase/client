import * as C from '../../../constants'
import * as Constants from '../../../constants/teams'
import * as ChatConstants from '../../../constants/chat2'
import type * as T from '../../../constants/types'
import Tabs from '.'
import * as Container from '../../../util/container'

type OwnProps = {
  teamID: T.Teams.TeamID
  selectedTab: T.Teams.TabKey
  setSelectedTab: (tab: T.Teams.TabKey) => void
}

export default (ownProps: OwnProps) => {
  const {selectedTab, setSelectedTab, teamID} = ownProps
  const teamMeta = C.useTeamsState(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const yourOperations = C.useTeamsState(s => Constants.getCanPerformByID(s, teamID))

  const admin = yourOperations.manageMembers
  const error = C.useTeamsState(s => s.errorInAddToTeam)
  const isBig = C.useChatState(s => ChatConstants.isBigTeam(s, teamID))
  const loading = Container.useAnyWaiting([
    Constants.teamWaitingKey(teamID),
    Constants.teamTarsWaitingKey(teamMeta.teamname),
  ])
  const newTeamRequests = C.useTeamsState(s => s.newTeamRequests)
  const numInvites = teamDetails?.invites?.size ?? 0
  const numRequests = teamDetails?.requests?.size ?? 0
  const numSubteams = teamDetails?.subteams?.size ?? 0
  const resetUserCount = C.useTeamsState(s => Constants.getTeamResetUsers(s, teamMeta.teamname).size)
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
