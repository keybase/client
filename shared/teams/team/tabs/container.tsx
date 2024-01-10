import * as C from '@/constants'
import type * as T from '@/constants/types'
import Tabs from '.'

type OwnProps = {
  teamID: T.Teams.TeamID
  selectedTab: T.Teams.TabKey
  setSelectedTab: (tab: T.Teams.TabKey) => void
}

const Container = (ownProps: OwnProps) => {
  const {selectedTab, setSelectedTab, teamID} = ownProps
  const teamMeta = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID))
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const yourOperations = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID))

  const admin = yourOperations.manageMembers
  const error = C.useTeamsState(s => s.errorInAddToTeam)
  const isBig = C.useChatState(s => C.Chat.isBigTeam(s, teamID))
  const loading = C.Waiting.useAnyWaiting([
    C.Teams.teamWaitingKey(teamID),
    C.Teams.teamTarsWaitingKey(teamMeta.teamname),
  ])
  const newTeamRequests = C.useTeamsState(s => s.newTeamRequests)
  const numInvites = teamDetails?.invites.size ?? 0
  const numRequests = teamDetails?.requests.size ?? 0
  const numSubteams = teamDetails?.subteams.size ?? 0
  const resetUserCount = C.useTeamsState(s => C.Teams.getTeamResetUsers(s, teamMeta.teamname).size)
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

export default Container
